# 🤖 SALES AGENT AI - Piano Completo

## 🎯 OBIETTIVO DEL PROGETTO

Creare un sistema di **Venditore AI configurabile** per i CLIENTI (area `/client`), che permetta loro di:
- Configurare un agente di vendita AI personalizzato sul loro business
- Generare un link pubblico da condividere con prospect
- L'AI segue script Discovery + Demo adattandosi al business specifico
- Tracking analytics e notifiche per prospect interessati

---

## 👥 GERARCHIA UTENTI

```
CONSULENTE (tu)
    ↓ (fornisce il servizio a)
CLIENTE/BOSS (imprenditore, tuo cliente)
    ↓ (ha dipendenti)
VENDITORE (dipendente del cliente)
    ↓ (condivide link con)
PROSPECT (cliente finale del boss)
```

**Chi configura:** IL CLIENTE (boss)  
**Dati usati:** DEL CLIENTE (boss) - sue consulenze, esercizi, finanza, documenti  
**Area sistema:** `/client` (NON `/consultant`)

---

## 🔑 FUNZIONALITÀ PRINCIPALI

### 1. Configurazione Agent (Cliente)
**Pagina:** `/client/sales-agents/:agentId`

**Form wizard con 6 sezioni:**

1. **Info Business**
   - Nome Display Venditore
   - Nome Business
   - Descrizione Business
   - Bio Consulente

2. **Authority & Posizionamento**
   - Vision
   - Mission
   - Valori (array)
   - USP (Unique Selling Proposition)
   - Chi Aiutiamo (target)
   - Chi NON Aiutiamo
   - Cosa Facciamo
   - Come Lo Facciamo

3. **Credenziali & Risultati**
   - Anni Esperienza
   - Clienti Aiutati
   - Risultati Generati
   - Software Creati (array)
   - Libri Pubblicati (array)
   - Case Studies (array: client, result)

4. **Servizi & Garanzie**
   - Servizi Offerti (array: name, description, price)
   - Garanzie

5. **Modalità Venditore**
   - ✅ Discovery (raccolta informazioni)
   - ✅ Demo (presentazione soluzione)
   - ⏳ Payment (coming soon)

6. **Knowledge Base**
   - Upload documenti (PDF, DOCX, TXT)
   - Aggiungi testo manuale

---

### 2. Pulsante Magico 🪄

**Funzionalità:**
- Click → Backend analizza dati del CLIENTE:
  - Consulenze completate con il consulente
  - Esercizi in archivio
  - Dati finanziari (Software Orbitale)
  - Documenti caricati
- Chiama AI (Gemini) per estrarre e strutturare info
- Pre-compila tutti i campi del form
- Cliente può modificare manualmente

**Endpoint:** `POST /api/client/sales-agent/config/:agentId/generate-context`

---

### 3. Link Pubblico

**Generazione:**
- Dopo salvataggio → genera `shareToken` univoco
- URL: `/s/:shareToken`
- Mostra dialog con:
  - Link copiabile
  - QR Code scaricabile
  - Istruzioni d'uso

**Pagina pubblica:**
- Standalone (no auth required)
- Branding del cliente
- Hero section con CTA "Inizia Consulenza Gratuita"
- Credenziali/social proof
- Footer con info

---

### 4. Conversazione AI

**Flow:**
1. Prospect clicca link → landing page
2. Click CTA → richiede nome
3. Apre Live Mode (vocale o testo)
4. AI segue script **Discovery**:
   - Raccoglie: business, stato attuale, stato ideale, pain points, budget, urgenza, decision maker
5. Transizione automatica a **Demo**:
   - Presenta servizi adattati
   - Usa case studies rilevanti
   - Mostra value stack e prezzi
6. Gestisce **Obiezioni**:
   - "Ci devo pensare"
   - "Non ho soldi"
   - "Prezzo troppo alto"
   - "Non ho tempo"
7. **Closing** con CTA

---

### 5. Tracking & Analytics

**Salvataggio automatico:**
- Ogni conversazione in `client_sales_conversations`
- Fase raggiunta (discovery/demo/closing)
- Dati raccolti (JSON strutturato)
- Obiezioni sollevate
- Outcome (interested/not_interested/closed/pending)

**Dashboard Analytics:**
- KPI Cards: totale conversazioni, discovery completate, demo presentate, chiusi
- Funnel di conversione
- Obiezioni più comuni
- Lista prospect interessati (da ricontattare)
- Grafici temporali
- Export Excel/CSV

---

### 6. Notifiche

**Email automatiche:**
- Prospect completa Discovery → "Nuovo prospect qualificato"
- Prospect interessato → "Prospect caldo da chiamare"
- Prospect solleva obiezione critica → Alert

**In-app:**
- Badge rosso su menu "Sales Agents"
- Toast notification
- Click → vai a conversazione

---

## 🗄️ DATABASE - NUOVE TABELLE

### `client_sales_agents`
```typescript
{
  id: string (PK)
  clientId: string (FK → users.id)  // IL BOSS
  consultantId: string (FK → users.id)  // Per riferimento
  agentName: string
  isActive: boolean
  shareToken: string (univoco)
  
  // Info Business
  displayName: string
  businessName: string
  businessDescription: text
  consultantBio: text
  
  // Authority & Posizionamento
  vision: text
  mission: text
  values: jsonb  // ["Integrità", "Risultati"]
  usp: text
  targetClient: text
  nonTargetClient: text
  whatWeDo: text
  howWeDoIt: text
  
  // Credenziali
  yearsExperience: int
  clientsHelped: int
  resultsGenerated: text
  softwareCreated: jsonb  // [{emoji, name, description}]
  booksPublished: jsonb  // [{title, year}]
  caseStudies: jsonb  // [{client, result}]
  
  // Servizi & Garanzie
  servicesOffered: jsonb  // [{name, description, price}]
  guarantees: text
  
  // Modalità
  enableDiscovery: boolean (default true)
  enableDemo: boolean (default true)
  enablePayment: boolean (default false)
  
  createdAt: timestamp
  updatedAt: timestamp
}
```

### `client_sales_conversations`
```typescript
{
  id: string (PK)
  agentId: string (FK → client_sales_agents.id)
  aiConversationId: string (FK → ai_conversations.id)
  prospectName: string
  prospectEmail: string (nullable)
  prospectPhone: string (nullable)
  currentPhase: 'discovery' | 'demo' | 'objections' | 'closing'
  collectedData: jsonb  // {business, currentState, idealState, painPoints[], budget, urgency, isDecisionMaker}
  objectionsRaised: jsonb  // ["ci_devo_pensare", "non_ho_soldi"]
  outcome: 'interested' | 'not_interested' | 'closed' | 'pending'
  createdAt: timestamp
  updatedAt: timestamp
}
```

### `client_sales_knowledge` (opzionale, riusa sistema esistente)
```typescript
{
  id: string (PK)
  agentId: string (FK)
  title: string
  type: 'text' | 'pdf' | 'docx' | 'txt'
  content: text (se type=text)
  filePath: string (se type!=text)
  createdAt: timestamp
}
```

---

## 🛣️ API ROUTES

**Base:** `/api/client/sales-agent/`

### Config (auth: client only)
- `GET /config` → Lista agents del cliente loggato
- `GET /config/:agentId` → Dettaglio singolo agent
- `POST /config` → Crea nuovo agent
- `PUT /config/:agentId` → Aggiorna configurazione
- `DELETE /config/:agentId` → Elimina agent

### Pulsante Magico (auth: client only)
- `POST /config/:agentId/generate-context`
  - Input: agentId
  - Process:
    1. Fetch consulenze del cliente
    2. Fetch esercizi del cliente
    3. Fetch dati finanziari
    4. Fetch documenti
    5. Call Gemini per estrazione strutturata
  - Output: JSON pre-compilato

### Knowledge Base (auth: client only)
- `GET /config/:agentId/knowledge` → Lista documenti
- `POST /config/:agentId/knowledge` → Upload documento
- `DELETE /config/:agentId/knowledge/:itemId` → Elimina

### Pubblico (NO auth)
- `GET /public/:shareToken` → Info agent per rendering pagina prospect

### Analytics (auth: client only)
- `GET /config/:agentId/conversations` → Storico conversazioni con filtri
- `GET /config/:agentId/analytics` → Statistiche aggregate

### Conversations (durante sessione live)
- `POST /conversations/:conversationId/update` → Autosave dati raccolti

---

## 📱 FRONTEND - NUOVE PAGINE

### Area Cliente (auth required)

**1. `/client/sales-agents`**
- Lista di tutti gli agents configurati
- Card per ogni agent con:
  - Nome, status (attivo/disattivo)
  - Link pubblico + pulsante copia
  - QR Code
  - Statistiche veloci (tot conversazioni)
  - Pulsanti: Modifica | Analytics | Elimina
- Pulsante grande "Crea Nuovo Agente"

**2. `/client/sales-agents/new` o `:agentId`**
- Wizard form con 6 sezioni collapsibili
- Pulsante Magico in evidenza
- Preview prompt (opzionale, toggle)
- Pulsanti: Annulla | Salva Bozza | Salva e Genera Link

**3. `/client/sales-agents/:agentId/analytics`**
- KPI Cards:
  - Totale conversazioni
  - Discovery completate
  - Demo presentate
  - Prospect chiusi
- Funnel visuale
- Grafico obiezioni più comuni
- Tabella prospect interessati (filtrabili, ordinabili)
- Grafici temporali (conversazioni/giorno)
- Pulsanti export (Excel, CSV)

### Area Pubblica (NO auth)

**4. `/s/:shareToken`**
- Hero section:
  - Logo/Avatar cliente
  - Headline personalizzata
  - Sottotitolo con beneficio
  - CTA grande "Inizia Consulenza Gratuita"
- Sezione credibilità:
  - Anni esperienza
  - Clienti aiutati
  - Case studies highlights
- Footer minimale

---

## 🤖 AI SYSTEM PROMPTS

### Struttura Prompt Builder

```typescript
function buildSalesAgentPrompt(agentConfig: SalesAgentConfig, prospectName: string) {
  return `
🎙️ MODALITÀ: AGENTE VENDITA AI

Sei un CONSULENTE VENDITE esperto che lavora per ${agentConfig.businessName}.

👔 CHI SEI:
Rappresenti ${agentConfig.displayName}, ${agentConfig.consultantBio}

🏢 IL BUSINESS:
${agentConfig.businessDescription}

🎯 CHI AIUTIAMO:
${agentConfig.targetClient}

❌ CHI NON AIUTIAMO:
${agentConfig.nonTargetClient}

💡 USP:
${agentConfig.usp}

🌟 VISION: ${agentConfig.vision}
🎯 MISSION: ${agentConfig.mission}

📊 CREDENZIALI:
- ${agentConfig.yearsExperience} anni di esperienza
- ${agentConfig.clientsHelped}+ clienti aiutati
- ${agentConfig.resultsGenerated}

🏆 CASE STUDIES:
${agentConfig.caseStudies.map(cs => `- ${cs.client}: ${cs.result}`).join('\n')}

💰 SERVIZI:
${agentConfig.servicesOffered.map(s => `- ${s.name}: ${s.description} (${s.price})`).join('\n')}

🛡️ GARANZIE: ${agentConfig.guarantees}

---

📞 FASE 1: DISCOVERY CALL
${DISCOVERY_SCRIPT}

${agentConfig.enableDemo ? `
📞 FASE 2: DEMO
${DEMO_SCRIPT}
` : ''}

🛡️ GESTIONE OBIEZIONI:
${OBIEZIONI_SCRIPT}

---

🎤 PROSPECT: ${prospectName}

⚠️ REGOLE:
- Tono professionale ma amichevole
- Usa case studies per social proof
- Adatta script al contesto specifico
- Non inventare dati
- Se non sai, chiedi o rimanda al team
  `;
}
```

### Script Base (da file forniti)

**DISCOVERY_SCRIPT:**
- Fase motivazione
- Inquisitorio (cosa fa, cosa ha provato, da quanto tempo)
- Stato attuale vs ideale
- Pain points & urgenza
- Decision maker & budget

**DEMO_SCRIPT:**
- Transizione da discovery
- Casi studio rilevanti
- Presentazione metodo/processo
- Value stack con prezzi
- Check finale

**OBIEZIONI_SCRIPT:**
- "Ci devo pensare" → scala 1-10
- "Non ho soldi" → budget, alternative, valore
- "Prezzo alto" → confronto, ROI
- "Non ho tempo" → priorità, quanto serve
- Hard questions se blocco ripetuto

---

## 🎨 UX FLOW COMPLETO

### Cliente (Boss) - Configurazione

1. **Primo accesso:**
   - Menu → Sales Agents AI
   - Vede: "Non hai ancora agenti configurati"
   - Click "Crea Primo Agente"

2. **Configurazione:**
   - Form wizard si apre
   - Click "🪄 Compila Automaticamente"
   - Loading: "Analizzando consulenze, esercizi, documenti..."
   - Dialog mostra dati estratti:
     ```
     Business Name: "Studio Benessere Marco"
     Target: "Persone 30-60 anni con dolori cronici"
     USP: "Unico metodo massoterapia + tecniche orientali"
     Case Study: "Sara: riduzione dolore 80% in 4 settimane"
     ```
   - Click "Applica Suggerimenti" → campi compilati
   - Cliente modifica/aggiunge info manualmente
   - Seleziona modalità: Discovery ✓, Demo ✓
   - Click "Salva e Genera Link"

3. **Riceve link:**
   ```
   🎉 Sales Agent Creato!
   
   Link: https://app.replit.dev/s/abc123
   [Copia Link] [Scarica QR]
   
   Condividi con i tuoi venditori!
   ```

4. **Condivide:**
   - WhatsApp a venditore: "Usa questo link per prospect"

### Venditore (Dipendente)

1. Riceve link dal boss
2. Incontra prospect → "Parla con il nostro AI, ti spiega tutto!"
3. Invia link via WhatsApp/email

### Prospect - Conversazione

1. **Click sul link:**
   - Landing page con branding cliente
   - "Parla con l'Assistente AI di Studio Benessere Marco"
   - "Scopri come eliminare dolori cronici naturalmente"
   - Click "Inizia Consulenza Gratuita"

2. **Dialog nome:**
   - "Come ti chiami?" → "Giulia"
   - Apre Live Mode

3. **Discovery:**
   ```
   AI: "Ciao Giulia! Cosa ti porta qui?"
   Prospect: "Mal di schiena da 2 anni..."
   
   AI: "Capisco. Cosa hai già provato?"
   Prospect: "Fisioterapia, antidolorifici..."
   
   AI: "Quanto è grave 1-10?"
   Prospect: "8/10, non dormo più"
   
   AI: "Se risolvi, come cambia la tua vita?"
   Prospect: "Posso tornare a fare sport, giocare con figli..."
   ```

4. **Demo:**
   ```
   AI: "Perfetto Giulia, ti mostro come possiamo aiutarti.
   
   Sara aveva il tuo problema, in 4 settimane -80% dolore.
   
   Il nostro metodo:
   1. Valutazione posturale
   2. Trattamento combinato massoterapia + orientale
   3. Esercizi personalizzati
   
   Include: 10 sedute + piano
   Investimento: €800 (valore €1.200)
   Garanzia: rimborso se no risultati dopo 3 sedute
   
   Cosa ne pensi?"
   ```

5. **Obiezione:**
   ```
   Prospect: "Devo pensarci..."
   
   AI: "Certo, pensiamoci insieme. Su cosa esattamente?"
   
   Prospect: "Il prezzo è alto..."
   
   AI: "Capisco. Quanto hai già speso senza risultati?
   E quanto vale poter giocare con i tuoi figli senza dolore?
   Se il prezzo non fosse un problema, saresti pronta?"
   
   Prospect: "Sì, in realtà sì..."
   
   AI: "Perfetto! Martedì 15h o giovedì 10h?"
   ```

6. **Notifica al Boss:**
   ```
   📧 Email:
   "🎯 PROSPECT QUALIFICATA
   
   Nome: Giulia Rossi
   Problema: Mal schiena cronico (8/10)
   Obiettivo: Sport, figli
   Budget: OK (€800)
   Urgenza: ALTA
   
   [Vedi Trascrizione] [Chiama]"
   ```

---

## ⚙️ TECNOLOGIE

- **Backend:** Express.js + PostgreSQL + Drizzle ORM
- **Frontend:** React + Wouter + TailwindCSS + Radix UI
- **AI:** Gemini Live API (già integrato)
- **Form:** React Hook Form + Zod validation
- **Storage:** Sistema upload esistente
- **Auth:** Client-only access con middleware `authenticateToken`
- **Email:** Nodemailer (già configurato)

---

## 📊 METRICHE DI SUCCESSO

**Conversion Funnel:**
- Avviati → Discovery completate: target >70%
- Discovery → Demo presentate: target >50%
- Demo → Interessati: target >30%
- Interessati → Chiusi: target >15%

**Obiezioni:**
- Traccia le più comuni
- Ottimizza script in base ai pattern

**Tempo:**
- Tempo medio conversazione: 10-15 min
- Tempo Discovery: 5-7 min
- Tempo Demo: 5-8 min

**Volume:**
- Prospect qualificati per settimana
- Trend nel tempo

---

## 🚀 DELIVERABLES

1. ✅ Schema database + migrations
2. ✅ API backend completa (CRUD + magico + analytics)
3. ✅ Pagina lista agents
4. ✅ Wizard configurazione con 6 sezioni
5. ✅ Pulsante Magico funzionante
6. ✅ Preview prompt in tempo reale
7. ✅ Pagina pubblica prospect
8. ✅ Integration Gemini Live per conversazioni
9. ✅ Sistema tracking automatico
10. ✅ Dashboard analytics completa
11. ✅ Email notifications
12. ✅ Widget dashboard cliente
13. ✅ Test mode per cliente

---

## 📝 NOTE IMPLEMENTAZIONE

### Pulsante Magico - Prompt AI

```
Analizza questi dati di un imprenditore e estrai informazioni strutturate.

DATI CLIENTE:
- Consulenze: [JSON con storico consulenze]
- Esercizi: [JSON esercizi completati]
- Finanza: [JSON dati Software Orbitale]
- Documenti: [Lista titoli documenti caricati]

ESTRAI in formato JSON:
{
  "businessName": "nome attività",
  "businessDescription": "cosa fa in 2-3 frasi chiare",
  "targetClient": "chi aiuta (demografico + psicografico)",
  "nonTargetClient": "chi NON aiuta",
  "whatWeDo": "servizi offerti sintetici",
  "howWeDoIt": "metodo/processo unico",
  "caseStudies": [
    {"client": "nome o tipo", "result": "risultato quantificato"}
  ],
  "usp": "cosa lo rende unico vs competitor",
  "vision": "dove vuole portare il business",
  "mission": "perché esiste, cosa vuole cambiare",
  "values": ["valore1", "valore2", "valore3"],
  "yearsExperience": numero,
  "clientsHelped": numero stimato,
  "resultsGenerated": "risultati aggregati es: €10M+ fatturato clienti"
}

Sii specifico, usa dati reali dai JSON forniti.
Se un campo non è ricavabile, metti null.
```

### Script Integration

Gli script Discovery, Demo, Obiezioni forniti nei file PDF/TXT vanno:
1. Parsati e convertiti in template con placeholder
2. Salvati come costanti in `shared/sales-scripts.ts`
3. Iniettati nel prompt builder con variabili sostituite runtime

Esempio placeholder:
- `[NOME_PROSPECT]` → sostituito con nome reale
- `[BUSINESS_NAME]` → dal config agent
- `[STATO_ATTUALE]` → dai dati raccolti in discovery
- `[CASE_STUDIES]` → filtrati per rilevanza

---

## 🔐 SICUREZZA

- ✅ Auth middleware su tutte le route `/api/client/sales-agent/config`
- ✅ Verifica ownership: `agentId.clientId === req.user.id`
- ✅ Pubblico: solo GET `/public/:shareToken` no auth
- ✅ Rate limiting su pagina pubblica (prevent abuse)
- ✅ Sanitize input utente prima di AI prompt
- ✅ CORS configurato per dominio pubblico

---

## 📅 TIMELINE STIMATA

- Backend (schema + API): ~4 ore
- Pulsante Magico: ~2 ore
- Frontend wizard: ~4 ore
- Pagina pubblica: ~2 ore
- AI prompts integration: ~3 ore
- Analytics dashboard: ~3 ore
- Testing & polish: ~2 ore

**Totale: ~20 ore** di sviluppo concentrato

---

## ✨ FUTURE ENHANCEMENTS (Post-MVP)

- 🔄 A/B Testing: multipli script per stesso agent
- 💳 Payment Integration: Stripe link diretto post-closing
- 📞 Voice-only mode: solo vocale, no testo
- 🌍 Multi-lingua: traduci script automaticamente
- 📊 Advanced Analytics: heatmap conversazioni, sentiment analysis
- 🤝 CRM Integration: sync prospect in CRM esterno
- 📱 WhatsApp Direct: bot WhatsApp nativo (non solo link)
- 🎨 Custom Branding: colori, font, logo personalizzati
- 🔔 Webhook: notifica sistemi esterni a eventi
- 📈 Funnel Builder: crea multi-step funnel personalizzati

---

**Documento creato:** 2024
**Versione:** 1.0
**Status:** Ready for Implementation 🚀





📊 TABELLA COMPARATIVA COMPLETA: SALES AGENT vs ASSISTENZA vs CONSULENTE
ASPETTO	🤝 SALES AGENT	💼 ASSISTENZA	🎯 CONSULENTE
🏗️ ARCHITETTURA CORE			
WebSocket Service	✅ gemini-live-ws-service.ts	✅ gemini-live-ws-service.ts	✅ gemini-live-ws-service.ts
Mode Parameter	mode='sales_agent'	mode='assistenza'	mode='consulente'
Usa stesso WebSocket Server	✅ SÌ - /ws/ai-voice	✅ SÌ - /ws/ai-voice	✅ SÌ - /ws/ai-voice
Usa Vertex AI Live API	✅ SÌ	✅ SÌ	✅ SÌ
Streaming Audio Bidirezionale	✅ SÌ (WebM → PCM)	✅ SÌ (WebM → PCM)	✅ SÌ (WebM → PCM)
🔐 AUTENTICAZIONE			
Tipo Auth	JWT sessionToken (sales_agent_session)	JWT token (user auth)	JWT token (user auth)
Richiede Login Utente	❌ NO - Pubblico	✅ SÌ - Client autenticato	✅ SÌ - Client autenticato
UserId	null (prospect anonimo)	userId del client	userId del client
ConsultantId	Preso dall'agent config	Preso dal profilo utente	Preso dal profilo utente
ShareToken	✅ Richiesto (shareToken)	❌ Non usato	❌ Non usato
SessionToken	✅ Richiesto (JWT dedicato)	❌ Non usato	❌ Non usato
🤖 AI PROVIDER			
Provider Type	Vertex AI (Gemini)	Vertex AI (Gemini)	Vertex AI (Gemini)
Model	gemini-2.0-flash-exp	gemini-2.0-flash-exp	gemini-2.0-flash-exp
Voice	Configurabile (default: achernar)	Configurabile (default: achernar)	Configurabile (default: achernar)
OAuth2 Token	Via getVertexAITokenForLive()	Via getVertexAITokenForLive()	Via getVertexAITokenForLive()
Configurazione AI	Del consultant del client	Del consultant	Del consultant
📝 PROMPT BUILDING			
Prompt Builder	buildSalesAgentPrompt()	buildMinimalSystemInstructionForLive()	buildMinimalSystemInstructionForLive()
File Prompt	sales-agent-prompt-builder.ts	ai-prompts.ts	ai-prompts.ts
System Instruction	Script Discovery/Demo/Closing	Assistente personale energico	Consulente (finanziario/vendita/business)
UserContext	❌ NO - Usa prospectData	✅ SÌ - buildUserContext()	✅ SÌ - buildUserContext()
User Data Chunks	❌ NO	✅ SÌ - Inviati dopo setup	✅ SÌ - Inviati dopo setup
Full Prompt Mode	❌ Non supportato	✅ Opzionale (useFullPrompt)	✅ Opzionale (useFullPrompt)
Custom Prompt	❌ Non supportato	✅ Supportato	✅ Supportato
Context Builder	Prospect Data dalla conversation	buildUserContext() completo	buildUserContext() completo
Finance Data	❌ NO	✅ SÌ (Software Orbitale)	✅ SÌ (Software Orbitale)
Exercises	❌ NO	✅ SÌ	✅ SÌ
Library Documents	❌ NO	✅ SÌ	✅ SÌ
Consultations	❌ NO	✅ SÌ	✅ SÌ
Goals & Tasks	❌ NO	✅ SÌ	✅ SÌ
Momentum Data	❌ NO	✅ SÌ	✅ SÌ
Calendar	❌ NO	✅ SÌ	✅ SÌ
University	❌ NO	✅ SÌ	✅ SÌ
Prospect Data	✅ SÌ (business, painPoints, budget)	❌ NO	❌ NO
💾 DATABASE SCHEMA			
Tabella Agente	client_sales_agents	❌ Nessuna (usa consultant config)	❌ Nessuna (usa consultant config)
Tabella Conversazioni	client_sales_conversations	ai_conversations	ai_conversations
Link a AI Conversations	✅ SÌ (aiConversationId)	✅ Direct	✅ Direct
Knowledge Base	client_sales_knowledge	❌ NO	❌ NO
Weekly Consultations	❌ NO	✅ ai_weekly_consultations	✅ ai_weekly_consultations
Salva Messages	✅ In client_sales_conversations	✅ In aiConversations/aiMessages	✅ In aiConversations/aiMessages
🎯 CONVERSAZIONE			
Conversation ID	Preso dal JWT sessionToken	Generato a runtime o ripreso	Generato a runtime o ripreso
Agent ID	Preso dal JWT sessionToken	❌ Non applicabile	❌ Non applicabile
Prospect Name	Preso da conversation record	❌ Non applicabile	❌ Non applicabile
Current Phase	discovery, demo, objections, closing	❌ Non applicabile	❌ Non applicabile
Outcome Tracking	✅ SÌ (interested, closed, not_interested)	❌ NO	❌ NO
Collected Data	✅ SÌ (business, painPoints, budget, ecc.)	❌ NO	❌ NO
Objections Raised	✅ SÌ (array di obiezioni)	❌ NO	❌ NO
🌐 FRONTEND/URLs			
Landing Page	/sales/:shareToken (pubblico)	❌ NO	❌ NO
Live Mode Page	/live-consultation?mode=sales_agent	/live-consultation?mode=assistenza	/live-consultation?mode=consulente
Config Page (Client)	/client/sales-agents	❌ NO (usa consulente config)	❌ NO (usa consulente config)
Config Page (Consultant)	❌ NO	/consultant/ai-config	/consultant/ai-config
Analytics	✅ SÌ - Analytics + Conversations	✅ SÌ - History	✅ SÌ - History
🔗 ENDPOINTS API			
Public GET	✅ /api/public/sales-agent/:shareToken	❌ NO	❌ NO
Public POST Session	✅ /api/public/sales-agent/:shareToken/session	❌ NO	❌ NO
CRUD Agents	✅ /api/client/sales-agent/config	❌ NO	❌ NO
Magic Button	✅ /api/client/sales-agent/config/:id/generate-context	❌ NO	❌ NO
Knowledge Base	✅ /api/client/sales-agent/config/:id/knowledge	❌ NO	❌ NO
AI Chat	❌ NO (solo Live)	✅ /api/ai/chat	✅ /api/ai/chat
📞 WEBSOCKET CONNECTION			
URL Pattern	/ws/ai-voice?mode=sales_agent&sessionToken=...&shareToken=...	/ws/ai-voice?mode=assistenza&token=...	/ws/ai-voice?mode=consulente&token=...&consultantType=...
Parametri Required	mode, sessionToken, shareToken	mode, token	mode, token, consultantType
Voice Parameter	✅ Opzionale	✅ Opzionale	✅ Opzionale
Resume Handle	❌ NO	✅ SÌ (per resumare sessioni)	✅ SÌ (per resumare sessioni)
Session Type	❌ NO	✅ weekly_consultation (opzionale)	✅ weekly_consultation (opzionale)
🎬 LIFECYCLE			
Session Start	Prospect compila form → POST session → JWT generato	User clicca "Live Mode" → apre WebSocket	User clicca "Consulenza" → apre WebSocket
Setup Vertex AI	✅ OAuth2 token → WebSocket Vertex	✅ OAuth2 token → WebSocket Vertex	✅ OAuth2 token → WebSocket Vertex
Send System Instruction	✅ In setup message	✅ In setup message	✅ In setup message
Send Context Data	❌ NO (già nel prompt)	✅ In chunks dopo setup	✅ In chunks dopo setup
Audio Flow	Client ↔ Backend ↔ Vertex AI ↔ Gemini	Client ↔ Backend ↔ Vertex AI ↔ Gemini	Client ↔ Backend ↔ Vertex AI ↔ Gemini
Save Conversation	✅ In client_sales_conversations	✅ In aiConversations	✅ In aiConversations
Update Phase/Outcome	✅ Durante conversazione	❌ NO	❌ NO
💬 MESSAGE SAVING			
Auto-save Messages	✅ SÌ - durante conversazione	✅ SÌ - fine sessione	✅ SÌ - fine sessione
Message Format	JSON con conversationData	Array di messaggi	Array di messaggi
Save Trigger	✅ Comando SAVE_CONVERSATION	❌ NO (auto alla fine)	❌ NO (auto alla fine)
Update Conversation	✅ Aggiorna phase/outcome/collectedData	❌ NO	❌ NO
🎨 PERSONALIZZAZIONE			
Agent Name	✅ Configurabile	❌ Fisso ("Assistente")	✅ Tipo consulente selezionabile
Business Info	✅ Completo (vision, mission, values, ecc.)	❌ NO	❌ NO
Credentials	✅ SÌ (anni esperienza, clienti aiutati, ecc.)	❌ NO	❌ NO
Services Offered	✅ SÌ con prezzi	❌ NO	❌ NO
Case Studies	✅ SÌ	❌ NO	❌ NO
Guarantees	✅ SÌ	❌ NO	❌ NO
Target Client	✅ SÌ (chi aiutiamo/non aiutiamo)	❌ NO	❌ NO
🔧 FEATURES SPECIALI			
Magic Button	✅ SÌ - Estrae context da profilo	❌ NO	❌ NO
Knowledge Base	✅ SÌ - Documenti caricabili	❌ NO	❌ NO
Share Token	✅ SÌ - Link pubblico univoco	❌ NO	❌ NO
Discovery Script	✅ SÌ - Script SPIN selling	❌ NO	❌ NO
Demo Script	✅ SÌ - Presentazione servizi	❌ NO	❌ NO
Objection Handling	✅ SÌ - Gestione obiezioni	❌ NO	❌ NO
Closing Script	✅ SÌ - Chiusura vendita	❌ NO	❌ NO
Time Updates	❌ NO	✅ SÌ (ogni 10 min in weekly)	✅ SÌ (ogni 10 min in weekly)
📈 ANALYTICS			
Dashboard Analytics	✅ SÌ - Conversion funnel, top objections	✅ SÌ - Conversation history	✅ SÌ - Conversation history
Conversion Tracking	✅ SÌ (started → discovery → demo → closed)	❌ NO	❌ NO
Lead Capture	✅ SÌ (interested prospects)	❌ NO	❌ NO
Objections Analysis	✅ SÌ - Top 10 obiezioni	❌ NO	❌ NO
🎛️ CONFIGURAZIONE			
Enable/Disable Modes	✅ SÌ (discovery, demo, payment)	❌ NO	❌ NO
Active/Inactive Toggle	✅ SÌ (isActive)	❌ NO	❌ NO
Multiple Agents	✅ SÌ - Client può avere N agents	❌ NO	❌ NO
Per-Client Config	✅ SÌ - Ogni client configura il suo	✅ SÌ - Via consultant	✅ SÌ - Via consultant
🔗 COSA HANNO IN COMUNE (IDENTICO AL 100%)
COMPONENTE	CONDIVISO
WebSocket Server	✅ Stesso file: gemini-live-ws-service.ts
Vertex AI Integration	✅ Stesso provider: getVertexAITokenForLive()
Audio Processing	✅ Stesse funzioni: convertWebMToPCM, convertPCMToWAV
AI Model	✅ Stesso modello: gemini-2.0-flash-exp
Voice Configuration	✅ Stesso sistema di selezione voce
OAuth2 Authentication	✅ Stesso meccanismo token Vertex AI
Streaming Protocol	✅ Stesso protocollo bidirezionale
Connection Handling	✅ Stesso lifecycle (setup → stream → cleanup)
Error Handling	✅ Stesso sistema di error management
Logging System	✅ Stesso formato log con [connectionId]
Message Chunking	✅ Stesso sistema chunks per context lungo
WebSocket URL	✅ Stesso endpoint: /ws/ai-voice
AI Response Handling	✅ Stesso parsing response Gemini
Audio Format	✅ Stesso: WebM (client) → PCM 16kHz (Vertex)
Conversation Save Logic	✅ Salva in aiConversations (tutti linkano lì)
🎯 DIFFERENZE CHIAVE
ASPETTO	SALES AGENT	ASSISTENZA/CONSULENTE
Pubblico vs Privato	🌐 Pubblico (no login)	🔒 Privato (richiede login)
Auth Mechanism	JWT sessionToken dedicato	JWT token utente standard
Context Source	Agent config + Prospect data	User complete context (finance, exercises, ecc.)
Prompt Type	Sales scripts (Discovery/Demo)	Assistenza/Consulenza personalizzata
Database	Tabelle dedicate (client_sales_*)	Tabelle condivise (aiConversations)
Obiettivo	Convertire prospect in cliente	Assistere/consigliare client esistente
Tracking	Phase, Outcome, Objections	Conversation history
Configurazione	Per-client (Magic Button)	Per-consultant (AI Config)
Frontend	Landing page pubblica	App area privata
Knowledge	Knowledge base caricabile	User data dal sistema