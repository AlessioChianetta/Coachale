# RDP - Autopilot + AdVisage + Publer Integration

## 1. Overview

Integrazione completa del flusso:
**Autopilot** → **AdVisage** → **Publer**

### Obiettivo
Generare contenuti social automaticamente con immagini AI e programmarli su Publer, con opzione di revisione manuale.

### Due Modalità
1. **Full Auto**: Genera testo → Genera immagine → Programma su Publer
2. **Controllato (Review Mode)**: Genera tutto → Mostra anteprima → Utente approva → Pubblica

---

## 2. Database Schema

### 2.1 Nuova Tabella: `autopilot_batches`
Traccia i batch di generazione autopilot per la review mode.

```sql
CREATE TABLE autopilot_batches (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  consultant_id VARCHAR REFERENCES users(id) ON DELETE CASCADE,
  
  -- Configurazione batch
  config JSONB NOT NULL DEFAULT '{}',
  
  -- Flags
  auto_generate_images BOOLEAN DEFAULT false,
  auto_publish BOOLEAN DEFAULT false,
  review_mode BOOLEAN DEFAULT true,
  
  -- Stato batch
  status VARCHAR(50) DEFAULT 'pending', -- pending, generating, awaiting_review, approved, published, cancelled
  
  -- Progresso
  total_posts INTEGER DEFAULT 0,
  generated_posts INTEGER DEFAULT 0,
  approved_posts INTEGER DEFAULT 0,
  published_posts INTEGER DEFAULT 0,
  failed_posts INTEGER DEFAULT 0,
  
  -- Retry info
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  completed_at TIMESTAMP,
  approved_at TIMESTAMP,
  published_at TIMESTAMP
);

CREATE INDEX idx_autopilot_batches_consultant ON autopilot_batches(consultant_id);
CREATE INDEX idx_autopilot_batches_status ON autopilot_batches(status);
```

### 2.2 Nuove Colonne in `content_posts`
Aggiungere campi per tracciare lo stato di generazione immagine e appartenenza al batch.

```sql
ALTER TABLE content_posts 
ADD COLUMN IF NOT EXISTS autopilot_batch_id VARCHAR REFERENCES autopilot_batches(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS image_generation_status VARCHAR(50) DEFAULT 'pending', -- pending, generating, completed, failed, skipped
ADD COLUMN IF NOT EXISTS image_generation_error TEXT,
ADD COLUMN IF NOT EXISTS image_generated_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS review_status VARCHAR(50) DEFAULT 'pending', -- pending, approved, rejected
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS char_limit_retries INTEGER DEFAULT 0;

CREATE INDEX idx_content_posts_batch ON content_posts(autopilot_batch_id);
CREATE INDEX idx_content_posts_image_status ON content_posts(image_generation_status);
CREATE INDEX idx_content_posts_review ON content_posts(review_status);
```

---

## 3. Backend Architecture

### 3.1 Nuovi Endpoint API

#### POST `/api/content/autopilot/generate-with-images`
Genera batch con immagini automatiche.

```typescript
interface AutopilotWithImagesRequest {
  // Config esistente
  startDate: string;
  endDate: string;
  platforms: { ... };
  postSchema?: string;
  // ...existing fields...
  
  // Nuovi flags
  autoGenerateImages: boolean;  // Genera immagini con AdVisage
  autoPublish: boolean;         // Programma automaticamente su Publer
  reviewMode: boolean;          // Se true, attende approvazione
  
  // Settings AdVisage
  advisageSettings?: {
    mood: 'professional' | 'energetic' | 'luxury' | 'minimalist' | 'playful';
    stylePreference: 'realistic' | '3d-render' | 'illustration' | 'cyberpunk' | 'lifestyle';
    brandColor?: string;
    brandFont?: string;
  };
}

interface AutopilotWithImagesResponse {
  success: boolean;
  batchId: string;
  status: 'generating' | 'awaiting_review' | 'published';
  totalPosts: number;
}
```

#### POST `/api/content/advisage/generate-image-server`
Genera immagine lato server con chiavi SuperAdmin.

```typescript
interface GenerateImageServerRequest {
  prompt: string;
  aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  consultantId: string;
}

interface GenerateImageServerResponse {
  success: boolean;
  imageUrl: string;  // Base64 o URL storage
  error?: string;
}
```

#### GET `/api/content/autopilot/batches`
Lista batch per revisione.

#### GET `/api/content/autopilot/batches/:batchId`
Dettagli batch con tutti i post.

#### POST `/api/content/autopilot/batches/:batchId/approve`
Approva batch e pubblica su Publer.

```typescript
interface ApproveBatchRequest {
  postIds?: string[];  // Se vuoto, approva tutti
  action: 'approve' | 'reject' | 'approve_selected';
}
```

#### POST `/api/content/autopilot/batches/:batchId/publish`
Pubblica i post approvati su Publer.

---

### 3.2 Service Layer

#### `content-autopilot-service.ts` - Modifiche

```typescript
// Nuova funzione principale
export async function generateAutopilotWithImages(
  config: AutopilotWithImagesConfig,
  res?: Response
): Promise<{ batchId: string; success: boolean }> {
  
  // 1. Crea batch record
  const batch = await createAutopilotBatch(config);
  
  // 2. Per ogni post da generare:
  for (const postConfig of postsToGenerate) {
    
    // 2a. Genera testo (con retry se supera limite)
    let textContent = null;
    let retries = 0;
    const MAX_RETRIES = 3;
    
    while (retries < MAX_RETRIES) {
      textContent = await generateContentIdeas(...);
      
      // Verifica lunghezza
      const copyLength = textContent.fullCopy?.length || 0;
      const charLimit = getCharLimitForPlatform(postConfig.platform);
      
      if (copyLength <= charLimit) {
        break; // OK, rispetta il limite
      }
      
      console.log(`[AUTOPILOT] Post supera limite (${copyLength}/${charLimit}), retry ${retries + 1}/${MAX_RETRIES}`);
      retries++;
    }
    
    if (!textContent || textContent.fullCopy?.length > charLimit) {
      // Dopo max retry, salva con warning
      await markPostAsFailed(postId, 'Character limit exceeded after max retries');
      continue;
    }
    
    // 2b. Salva post
    const post = await saveContentPost(textContent);
    
    // 2c. Se autoGenerateImages, genera immagine
    if (config.autoGenerateImages) {
      try {
        // Analizza con AdVisage
        const analysis = await analyzeWithAdvisage(post.fullCopy, postConfig.platform);
        
        // Genera immagine con primo concept
        const imageUrl = await generateImageServerSide(
          analysis.concepts[0].promptClean,
          analysis.concepts[0].recommendedFormat
        );
        
        // Aggiorna post con immagine
        await updatePostWithImage(post.id, imageUrl, analysis);
        
      } catch (imageError) {
        await markImageGenerationFailed(post.id, imageError.message);
      }
    }
    
    // 2d. Se autoPublish e non reviewMode, programma su Publer
    if (config.autoPublish && !config.reviewMode) {
      await scheduleOnPubler(post);
    }
  }
  
  // 3. Aggiorna stato batch
  if (config.reviewMode) {
    await updateBatchStatus(batch.id, 'awaiting_review');
  } else if (config.autoPublish) {
    await updateBatchStatus(batch.id, 'published');
  } else {
    await updateBatchStatus(batch.id, 'completed');
  }
  
  return { batchId: batch.id, success: true };
}
```

#### `advisage-server-service.ts` - Nuovo File

```typescript
import { getAIProvider } from './ai-provider';

export async function generateImageServerSide(
  prompt: string,
  aspectRatio: string,
  consultantId: string
): Promise<string> {
  
  // Usa chiavi SuperAdmin come per altri servizi AI
  const { client, metadata } = await getAIProvider(consultantId, consultantId);
  
  // Chiama Gemini image generation
  const response = await client.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      imageConfig: { aspectRatio }
    }
  });
  
  // Estrai immagine base64
  const part = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
  if (!part?.inlineData) {
    throw new Error('Image generation failed');
  }
  
  return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
}
```

---

## 4. Frontend Architecture

### 4.1 Modifiche UI Autopilot

File: `client/src/pages/content-studio/ideas.tsx` (sezione Autopilot)

#### Nuovi Toggle nel Form

```tsx
// Nuovi controlli nel dialog Autopilot
<div className="space-y-4 border-t pt-4 mt-4">
  <h4 className="font-medium">Opzioni Avanzate</h4>
  
  {/* Toggle Genera Immagini */}
  <div className="flex items-center justify-between">
    <div>
      <Label>Genera Immagini Automatiche</Label>
      <p className="text-xs text-muted-foreground">
        Usa AdVisage AI per creare immagini per ogni post
      </p>
    </div>
    <Switch
      checked={autoGenerateImages}
      onCheckedChange={setAutoGenerateImages}
    />
  </div>
  
  {/* Toggle Pubblica Automaticamente */}
  <div className="flex items-center justify-between">
    <div>
      <Label>Pubblica Automaticamente</Label>
      <p className="text-xs text-muted-foreground">
        Programma su Publer all'orario prestabilito
      </p>
    </div>
    <Switch
      checked={autoPublish}
      onCheckedChange={setAutoPublish}
    />
  </div>
  
  {/* Toggle Review Mode */}
  <div className="flex items-center justify-between">
    <div>
      <Label>Modalità Controllo</Label>
      <p className="text-xs text-muted-foreground">
        Rivedi i post prima della pubblicazione
      </p>
    </div>
    <Switch
      checked={reviewMode}
      onCheckedChange={setReviewMode}
      disabled={!autoPublish} // Solo se autoPublish è attivo
    />
  </div>
  
  {/* Settings AdVisage (visibile solo se autoGenerateImages) */}
  {autoGenerateImages && (
    <div className="space-y-3 p-3 bg-muted rounded-lg">
      <Label>Stile Immagini</Label>
      <Select value={advisageMood} onValueChange={setAdvisageMood}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="professional">Professionale</SelectItem>
          <SelectItem value="energetic">Energetico</SelectItem>
          <SelectItem value="luxury">Luxury</SelectItem>
          <SelectItem value="minimalist">Minimalista</SelectItem>
          <SelectItem value="playful">Giocoso</SelectItem>
        </SelectContent>
      </Select>
      
      <Select value={advisageStyle} onValueChange={setAdvisageStyle}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="realistic">Realistico</SelectItem>
          <SelectItem value="3d-render">3D Render</SelectItem>
          <SelectItem value="illustration">Illustrazione</SelectItem>
          <SelectItem value="lifestyle">Lifestyle</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )}
</div>
```

### 4.2 Nuova Pagina: Review Batch

File: `client/src/pages/content-studio/autopilot-review.tsx`

#### Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📋 Revisione Batch #ABC123                                     │
│  Generato il 29/01/2026 - 12 post in attesa di approvazione    │
├─────────────────────────────────────────────────────────────────┤
│  [✓ Seleziona Tutti]  [Approva Selezionati]  [Rifiuta Tutti]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────┬────────────────────────────────────────────────┐ │
│  │          │  Instagram • 31 Gen 11:00                      │ │
│  │  [IMG]   │  ─────────────────────────────────────────     │ │
│  │          │  "La sindrome del centralino umano..."          │ │
│  │          │  1956 caratteri ✓                               │ │
│  │          │  ─────────────────────────────────────────     │ │
│  │          │  [👁 Anteprima] [✏️ Modifica] [✓] [✗]          │ │
│  └──────────┴────────────────────────────────────────────────┘ │
│                                                                 │
│  ┌──────────┬────────────────────────────────────────────────┐ │
│  │          │  LinkedIn • 31 Gen 12:00                       │ │
│  │  [IMG]   │  ─────────────────────────────────────────     │ │
│  │          │  "Il Metabolismo Lento della Lead Gen..."       │ │
│  │          │  2650 caratteri ✓                               │ │
│  │          │  ─────────────────────────────────────────     │ │
│  │          │  [👁 Anteprima] [✏️ Modifica] [✓] [✗]          │ │
│  └──────────┴────────────────────────────────────────────────┘ │
│                                                                 │
│  ... altri post ...                                            │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  Selezionati: 8/12    [Approva e Programma su Publer]          │
└─────────────────────────────────────────────────────────────────┘
```

#### Componenti Chiave

```tsx
// Card singolo post
interface PostReviewCardProps {
  post: ContentPost;
  isSelected: boolean;
  onSelect: (selected: boolean) => void;
  onApprove: () => void;
  onReject: () => void;
  onEdit: () => void;
}

function PostReviewCard({ post, ...props }: PostReviewCardProps) {
  return (
    <Card className={cn(
      "transition-all",
      props.isSelected && "ring-2 ring-primary"
    )}>
      <div className="flex gap-4 p-4">
        {/* Checkbox selezione */}
        <Checkbox 
          checked={props.isSelected}
          onCheckedChange={props.onSelect}
        />
        
        {/* Immagine anteprima */}
        <div className="w-24 h-24 bg-muted rounded-lg overflow-hidden">
          {post.imageUrl ? (
            <img src={post.imageUrl} className="w-full h-full object-cover" />
          ) : (
            <div className="flex items-center justify-center h-full">
              <ImageIcon className="w-8 h-8 text-muted-foreground" />
            </div>
          )}
        </div>
        
        {/* Contenuto */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge>{post.platform}</Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(post.scheduledAt), "d MMM HH:mm", { locale: it })}
            </span>
            <Badge variant={post.fullCopy.length <= getCharLimit(post.platform) ? "default" : "destructive"}>
              {post.fullCopy.length} caratteri
            </Badge>
          </div>
          
          <p className="text-sm line-clamp-2">{post.fullCopy}</p>
          
          {/* Azioni */}
          <div className="flex gap-2 mt-3">
            <Button size="sm" variant="ghost" onClick={props.onEdit}>
              <Pencil className="w-4 h-4 mr-1" /> Modifica
            </Button>
            <Button size="sm" variant="ghost" className="text-green-600">
              <Check className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-red-600">
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
```

---

## 5. Flow Diagrams

### 5.1 Full Auto Mode

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
│  Autopilot  │───▶│  Genera      │───▶│  AdVisage   │───▶│   Publer    │
│  Config     │    │  Testo       │    │  Genera IMG │    │  Programma  │
└─────────────┘    └──────────────┘    └─────────────┘    └─────────────┘
                         │
                         ▼
                   ┌──────────────┐
                   │  Verifica    │
                   │  Lunghezza   │
                   └──────────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
         OK (≤ limite)        ERRORE (> limite)
              │                     │
              ▼                     ▼
         Continua            Retry (max 3x)
```

### 5.2 Review Mode

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│  Autopilot  │───▶│  Genera      │───▶│  AdVisage   │
│  Config     │    │  Testo       │    │  Genera IMG │
└─────────────┘    └──────────────┘    └─────────────┘
                                             │
                                             ▼
                                       ┌─────────────┐
                                       │  Salva in   │
                                       │  Batch      │
                                       └─────────────┘
                                             │
                                             ▼
                                       ┌─────────────┐
                                       │  UI Review  │◀──── Utente
                                       │  Anteprima  │
                                       └─────────────┘
                                             │
                              ┌──────────────┴──────────────┐
                              ▼                             ▼
                        Approva                        Rifiuta
                              │                             │
                              ▼                             ▼
                       ┌─────────────┐              ┌─────────────┐
                       │   Publer    │              │  Cancella   │
                       │  Programma  │              │   Post      │
                       └─────────────┘              └─────────────┘
```

---

## 6. Task Implementation Order

### Fase 1: Database
1. ✅ Creare tabella `autopilot_batches` con SQL diretto
2. ✅ Aggiungere colonne a `content_posts` con SQL diretto

### Fase 2: Backend
3. Creare `advisage-server-service.ts` per generazione immagini server-side
4. Creare endpoint `/api/content/advisage/generate-image-server`
5. Modificare `content-autopilot-service.ts`:
   - Aggiungere retry loop per limite caratteri
   - Integrare chiamata AdVisage
   - Gestire batch e review mode
6. Creare endpoint batch: list, get, approve, publish

### Fase 3: Frontend
7. Modificare UI Autopilot con nuovi toggle
8. Creare pagina review batch
9. Integrare con flusso esistente

### Fase 4: Test
10. Test end-to-end completo

---

## 7. Considerazioni Tecniche

### 7.1 Rate Limiting
- Gemini image generation: usa semaforo esistente (max 3 concurrent)
- Publer API: rispettare rate limits

### 7.2 Error Handling
- Se generazione immagine fallisce: post salvato senza immagine, status = 'image_failed'
- Se Publer fallisce: post resta in 'scheduled', retry manuale

### 7.3 Performance
- Generazione batch: usa SSE per progress updates
- Immagini: genera in parallelo (max 3)

### 7.4 Storage
- Immagini base64 salvate in `imageUrl` (come AdVisage esistente)
- Alternativa futura: upload su Publer media library

---

## 8. Timeline Stimata

| Fase | Task | Tempo Stimato |
|------|------|---------------|
| DB | Schema + migrazioni | 30 min |
| Backend | Servizio immagini | 1h |
| Backend | Autopilot modifiche | 2h |
| Backend | Endpoint batch | 1h |
| Frontend | Toggle UI | 1h |
| Frontend | Pagina review | 2h |
| Test | E2E | 1h |
| **Totale** | | **~8h** |
