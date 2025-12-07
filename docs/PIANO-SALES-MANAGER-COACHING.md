# Piano Tecnico: Log Dettagliati Sales Manager + Trascrizione UI

**Data:** 7 Dicembre 2025  
**Stato:** IMPLEMENTATO  
**Obiettivo:** Aggiungere log dettagliati del ragionamento Sales Manager AI (simili al Sales AI) e sezione trascrizione minimizzabile nel CoachingPanel

---

## 1. ARCHITETTURA

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        VIDEO COACHING FLOW                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐     WebSocket      ┌────────────────────┐                │
│  │  VideoRoom   │ ──────────────────▶│ video-ai-copilot.ts│                │
│  │  (Client)    │                    │    (Server WS)     │                │
│  └──────────────┘                    └─────────┬──────────┘                │
│         │                                      │                           │
│         │ audio_chunk                          │ transcribe                │
│         ▼                                      ▼                           │
│  ┌──────────────┐                    ┌────────────────────┐                │
│  │useAudioCapture│                   │ transcribeAudio()  │                │
│  │  (Hook)      │                    │   (Gemini 2.0)     │                │
│  └──────────────┘                    └─────────┬──────────┘                │
│                                                │                           │
│                                                ▼                           │
│                                      ┌────────────────────┐                │
│                                      │SalesManagerAgent   │                │
│                                      │   .analyze()       │                │
│                                      └─────────┬──────────┘                │
│                                                │                           │
│                                                ▼                           │
│  ┌──────────────┐     WebSocket      ┌────────────────────┐                │
│  │CoachingPanel │ ◀──────────────────│ sales_coaching msg │                │
│  │  (Client)    │                    │ transcript msg     │                │
│  └──────────────┘                    └────────────────────┘                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. MODIFICHE IMPLEMENTATE

### 2.1 Log INPUT (video-ai-copilot.ts ~ linea 636)

Aggiunto log dettagliato PRIMA della chiamata a `SalesManagerAgent.analyze()`:

```
📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📥 [SALES-MANAGER] INPUT ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📜 SCRIPT INPUT: 8,432 chars (~2,108 tokens)
      └─ Phases: 5
      └─ Current Phase: Discovery (2/5)
      └─ Current Step: Domanda Budget (3/4)
   💬 FRESH TEXT (Recent Transcript): 1,247 chars (~312 tokens)
      └─ Messages: 8
      └─ Last 3 messages:
         1. [USER] "Sì, abbiamo un budget di circa 50.000 euro..."
         2. [ASSISTANT] "Perfetto, e qual è la timeline prevista..."
         3. [USER] "Vorremmo partire entro fine anno"
   🔗 CONNECTION:
      └─ Meeting ID: mtg_abc123
      └─ Consultant ID: cons_xyz789
      └─ Participants: 2
      └─ Archetype State: decisore (78%)
📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.2 Log REASONING (sales-manager-agent.ts ~ linea 1010)

Aggiunto log del ragionamento AI DOPO l'analisi parallela:

```
🧠 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 [SALES-MANAGER] AI REASONING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   📊 MODEL: gemini-2.0-flash
   ⏱️ LATENCY: 1,247ms

   🧠 REASONING:
      Il prospect ha fornito informazioni concrete sul budget (50k annui) 
      e sulla timeline (fine anno). Questi sono segnali di acquisto forti. 
      Il checkpoint "budget" è completato. Possiamo avanzare alla fase 
      di presentazione soluzione.

   📤 AI DECISIONS:
      └─ Should Advance: ✅ YES
      └─ Next Phase: phase_3_presentation
      └─ Confidence: 87%

   🎭 ARCHETYPE INTUITION:
      └─ Detected: decisore
      └─ Reasoning: "Risponde in modo diretto e concreto..."
🧠 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.3 Log OUTPUT (video-ai-copilot.ts ~ linea 679)

Aggiunto log dettagliato DOPO la risposta del Sales Manager:

```
📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 [SALES-MANAGER] OUTPUT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ⏱️ TOTAL TIME: 1,312ms
   📊 MODEL: gemini-2.0-flash

   📊 STEP ADVANCEMENT:
      └─ Should Advance: ✅ YES
      └─ Next Phase: phase_3_presentation
      └─ Confidence: 87%
      └─ Reasoning: "Il prospect ha mostrato interesse..."

   💬 COACHING FEEDBACK:
      └─ Priority: MEDIUM
      └─ Type: buy_signal
      └─ Message: "Il prospect ha mostrato interesse concreto..."

   💰 BUY SIGNALS: 2 detected
      1. [timeline] "Vorremmo partire entro fine anno..." (85%)
      2. [price_inquiry] "budget di circa 50.000 euro..." (92%)

   🎭 ARCHETYPE STATE:
      └─ Current: decisore
      └─ Confidence: 78%
📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 2.4 Sezione Trascrizione Collapsible (CoachingPanel.tsx)

Aggiunta sezione minimizzabile nel CoachingPanel:

```
┌────────────────────────────────────────┐
│ 📝 Trascrizione (8 msg)          [▼]  │  ◀── Clicca per espandere/minimizzare
├────────────────────────────────────────┤
│ 🎤 Host: Buongiorno, come posso       │
│    aiutarla oggi?                     │
│                                        │
│ 👤 Prospect: Cerco una soluzione      │
│    per gestire il mio team...         │
│                                        │
│ 🎤 Host: Capisco, quante persone      │
│    ha nel team?                       │
│                                        │
│ 👤 Prospect: Circa 15 persone         │
│                                        │
│         [Auto-scroll ↓]               │
└────────────────────────────────────────┘
```

---

## 3. FILE MODIFICATI

| File | Modifica |
|------|----------|
| `server/websocket/video-ai-copilot.ts` | +30 righe log INPUT, +25 righe log OUTPUT |
| `server/ai/sales-manager-agent.ts` | +35 righe log REASONING |
| `client/src/components/video-room/CoachingPanel.tsx` | +70 righe sezione trascrizione collapsible |
| `client/src/components/video-room/VideoRoom.tsx` | +3 righe (passaggio props transcript) |

---

## 4. COME TESTARE

1. Avviare una video call come host
2. Iniziare a parlare (host e prospect)
3. Controllare i log del server per vedere:
   - `📥 [SALES-MANAGER] INPUT ANALYSIS` - cosa viene inviato
   - `🧠 [SALES-MANAGER] AI REASONING` - ragionamento dell'AI
   - `📤 [SALES-MANAGER] OUTPUT` - cosa viene restituito
4. Nel CoachingPanel, cliccare sulla sezione "Trascrizione" per vedere la cronologia

---

**Autore:** AI Assistant  
**Versione:** 1.0  
**Stato:** Completato
