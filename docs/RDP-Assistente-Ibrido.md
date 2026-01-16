# RDP - Assistente AI Ibrido + Customer Support WhatsApp

**Data**: 16 Gennaio 2026  
**Versione**: 1.0  
**Stato**: In Approvazione

---

## 📋 Obiettivo del Progetto

Trasformare l'Assistente AI della piattaforma in un sistema **ibrido** che:
1. Mantiene la conoscenza contestuale della piattaforma (esercizi, finanze, consulenze)
2. Può rispondere a **domande generali** come un Gemini normale
3. Su WhatsApp, diventa un vero **Customer Support** che replica il consulente

---

## 📂 File da Modificare

### File 1: `server/ai-prompts.ts`

**Sezione**: Funzione `buildSystemPrompt()` → modalità `"assistenza"` (riga ~1352)

**Tipo di modifica**: Aggiunta di istruzioni

**Cosa aggiungerò**:
```
🧠 SEI UN ASSISTENTE IBRIDO

Hai accesso completo ai dati dell'utente (esercizi, finanze, consulenze, corsi),
MA sei anche un'intelligenza artificiale completa con conoscenza generale.

REGOLA D'ORO - COME DECIDERE:
1. Domanda sulla PIATTAFORMA (esercizi, budget, consulenze, corsi) → Usa i dati utente
2. Domanda GENERALE (come funziona X?, cos'è Y?, spiegami Z) → Rispondi normalmente come AI
3. Domanda MISTA → Combina conoscenza generale + dati utente

ESEMPI:
✅ "Come funziona NotebookLM?" → Spiega NotebookLM (conoscenza generale)
✅ "Cos'è il metodo FIRE?" → Spiega FIRE movement (conoscenza generale)
✅ "Quanti esercizi ho?" → Usa dati utente
✅ "Come posso migliorare il budget?" → Best practices generali + dati specifici utente

❌ MAI DIRE: "Non ho questa informazione nei tuoi dati" per domande generali
✅ INVECE: Rispondi normalmente come faresti su Gemini
```

**Posizione nel codice**: Subito dopo l'apertura del blocco `if (mode === "assistenza")`, prima delle altre istruzioni.

---

### File 2: `server/whatsapp/message-processor.ts`

**Sezione**: Blocco `MODALITÀ WHATSAPP ATTIVA` nel concise mode (riga ~1056-1120)

**Tipo di modifica**: Sostituzione/Integrazione del blocco istruzioni

**Stato attuale** (cosa c'è ora):
- Tono generico "conversazionale"
- Focus su brevità ma senza identità precisa
- Non ha capacità ibrida Gemini

**Cosa diventerà**:
```
📱 MODALITÀ CUSTOMER SUPPORT WHATSAPP

🎯 CHI SEI:
Sei l'assistenza clienti della piattaforma. Rispondi come se fossi il consulente stesso
che parla direttamente col cliente. Sei professionale, cordiale e risolvi problemi.

💬 STILE COMUNICAZIONE:
- Breve e diretto (max 2-3 messaggi corti)
- Professionale ma cordiale (no freddo, no eccessivamente entusiasta)
- Risolvi il problema, non fare coaching
- Se non sai qualcosa: "Fammi verificare" (non inventare)

🧠 CAPACITÀ IBRIDA:
Puoi rispondere sia a domande sulla piattaforma CHE a domande generali.
- "Come funziona Notion?" → Spiega normalmente
- "Quanti esercizi ho?" → Usa dati utente
- "Cos'è il metodo delle buste?" → Spiega (conoscenza generale)

✅ ESEMPI CORRETTI:

Cliente: "Non capisco come completare l'esercizio sul budget"
Tu: "Quale parte ti blocca? Le domande 1-3 riguardano le entrate, 
le 4-6 le uscite. Dimmi dove sei fermo e ti aiuto."

Cliente: "Come funziona ChatGPT?"
Tu: "ChatGPT è un assistente AI di OpenAI. Puoi fargli domande, 
chiedergli di scrivere testi, analizzare documenti. Ti serve per qualcosa di specifico?"

Cliente: "Quando ho la prossima consulenza?"
Tu: "Hai una consulenza giovedì 18 alle 15:00. Ti serve altro?"

❌ NON FARE MAI:
- "Evvai! Super! Fantastico!" (troppo entusiasta)
- Papiri lunghi con liste infinite
- "Ti consiglio di aprire la lezione X" (su WhatsApp non funziona)
- Inventare informazioni se non le hai
```

---

## 🔄 Comportamento Atteso Dopo le Modifiche

### Assistente Web (Portale)

| Prima | Dopo |
|-------|------|
| "Non ho info su NotebookLM nei tuoi esercizi" | Spiega NotebookLM normalmente |
| Forza sempre il contesto piattaforma | Riconosce quando la domanda è generale |
| Stesso stile per tutto | Stile adattivo: generale vs piattaforma |

### WhatsApp Clienti

| Prima | Dopo |
|-------|------|
| Tono motivazionale generico | Assistenza clienti professionale |
| "Evvai! Super!" | Cordiale ma professionale |
| Solo domande piattaforma | Anche domande generali (ibrido) |
| Suggerisce "apri lezione X" | "Quando accedi, vai in sezione X" |
| Risposte lunghe strutturate | Brevi e dirette |

---

## 📊 Test Cases Previsti

### Assistente Web

| Input | Output Atteso |
|-------|---------------|
| "Come funziona NotebookLM?" | Spiegazione di NotebookLM (Google) |
| "Cos'è il FIRE movement?" | Spiegazione Financial Independence Retire Early |
| "Quanti esercizi ho?" | "Hai X esercizi: Y completati, Z da fare" |
| "Come posso risparmiare di più?" | Best practices + dati Software Orbitale se disponibili |

### WhatsApp Clienti

| Input | Output Atteso |
|-------|---------------|
| "Ciao, non riesco a completare l'esercizio" | "Quale esercizio? Dimmi dove sei bloccato e ti aiuto." |
| "Come funziona Notion?" | Breve spiegazione di Notion |
| "Quando ho la consulenza?" | "Hai consulenza [data] alle [ora]." |
| "Non capisco la domanda 3" | Legge la domanda 3 e aiuta a rispondere |

---

## ⚠️ Cosa NON Cambia

- La struttura generale del system prompt
- I dati utente (esercizi, finanze, consulenze) rimangono accessibili
- Le azioni cliccabili `[ACTIONS]` nell'assistente web
- La modalità "consulente" (finanziario/business/vendita)
- La modalità WhatsApp per LEAD (sales agent)
- Il File Search e RAG

---

## 🚀 Piano di Implementazione

| # | Task | File | Stima |
|---|------|------|-------|
| 1 | Aggiungere sezione "Assistente Ibrido" nel prompt assistenza | `ai-prompts.ts` | 5 min |
| 2 | Trasformare WhatsApp client in Customer Support | `message-processor.ts` | 10 min |
| 3 | Test manuale comportamento | - | 5 min |

---

## ✅ Checklist Implementazione

- [x] File 1 (`ai-prompts.ts`) - ✅ IMPLEMENTATO (riga 1360-1406)
- [x] File 2 (`message-processor.ts`) - ✅ IMPLEMENTATO (riga 1061-1119)
- [x] Comportamento atteso chiaro
- [x] Test cases definiti

---

## 📝 Modifiche Effettuate

### `server/ai-prompts.ts`
**Posizione**: Riga 1360-1406 (dentro `if (mode === "assistenza")`)

Aggiunta sezione "🧠 SEI UN ASSISTENTE IBRIDO" con:
- Regola d'oro per decidere tra domanda piattaforma/generale/mista
- Esempi concreti (NotebookLM, FIRE, ETF, esercizi, budget)
- Cosa NON fare mai

### `server/whatsapp/message-processor.ts`
**Posizione**: Riga 1061-1119 (blocco WhatsApp Concise Mode)

Trasformato in "📱 MODALITÀ CUSTOMER SUPPORT WHATSAPP" con:
- Identità: assistenza clienti professionale
- Stile: breve, diretto, problem-solving
- Capacità ibrida: domande generali + piattaforma
- Esempi customer support realistici
- Anti-pattern: no entusiasmo eccessivo, no papiri

---

**Stato**: ✅ COMPLETATO
