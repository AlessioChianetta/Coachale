# 📖 Guida Completa - Training Map

## Cos'è la Training Map?

La **Training Map** è uno strumento di analisi avanzata che ti permette di visualizzare nel dettaglio come il tuo Sales Agent AI ha gestito ogni conversazione di vendita. Puoi vedere esattamente:

- ✅ **Quali fasi dello script sono state completate**
- 🎯 **Perché l'AI ha attivato ogni fase** (ragionamenti con evidenze)
- 📋 **Quali checkpoint sono stati raggiunti**
- 🔍 **Come l'AI ha usato la tecnica Ladder (3-5 PERCHÉ)**
- 💬 **Quali domande sono state fatte e quando**
- 🚧 **Dove la conversazione si è interrotta** (se applicabile)

---

## 🗺️ Come Navigare la Training Map

### 1. **Visual Flow Roadmap** (Percorso Visuale)

Il grafico a sinistra mostra tutte le 7 fasi del sales script come nodi collegati:

- **Nodo Verde (✓)**: Fase completata con successo
- **Nodo Giallo (⏱️)**: Fase corrente (ultima raggiunta)
- **Nodo Grigio (○)**: Fase non ancora raggiunta
- **Frecce**: Indicano il flusso naturale tra le fasi

**💡 TIP**: Clicca su un nodo per visualizzare i dettagli di quella fase nel pannello "Sales Script" a destra.

---

### 2. **Sales Script** (Pannello Centrale)

Questo pannello mostra la struttura completa dello script di vendita:

#### **Accordion delle Fasi**

Ogni fase può essere espansa cliccando sulla freccia. All'interno troverai:

##### **🎯 Ragionamenti AI** (quando disponibili)

Questa sezione appare solo se l'AI ha attivato quella fase. Ti mostra:

- **Reasoning**: Spiegazione testuale del perché l'AI ha attivato questa fase
- **Domanda Matchata**: La domanda dello script che ha triggerato l'attivazione
- **Keywords**: Parole chiave rilevate nella risposta dell'utente
- **Match %**: Percentuale di similarità semantica (verde = alta, giallo = media, arancione = bassa)
- **Timestamp**: Quando la fase è stata attivata

##### **🔒 Empty State: Fase Non Raggiunta**

Se vedi questo messaggio con l'icona del lucchetto, significa che la conversazione non è arrivata a questa fase. I ragionamenti appariranno quando l'AI raggiungerà la fase in future conversazioni.

##### **💭 Empty State: Nessun Ragionamento**

Se la fase è stata raggiunta ma non vedi ragionamenti, significa che:
- La fase è stata attivata automaticamente (senza trigger semantico)
- La conversazione è avvenuta prima dell'implementazione del tracking dettagliato

##### **Step della Fase**

Sotto i ragionamenti, ogni fase mostra i suoi **step** (sottofasi):

- **Numero e Nome**: Es. "Step 1: APERTURA ENTUSIASTICA"
- **Obiettivo**: Cosa deve ottenere l'AI in questo step
- **Badge Ladder 🔍**: Indica se questo step richiede la tecnica ladder (3-5 PERCHÉ)

##### **Domande dello Script** (🔍 Mostra/Nascondi)

Clicca il pulsante "Mostra domande" in alto per vedere:

- **Lista completa delle domande** per ogni step
- **Badge ✓ Fatta**: Appare se l'AI ha fatto quella domanda durante la conversazione
- **Timestamp**: Quando la domanda è stata fatta

---

### 3. **Checkpoint Detail** (Pannello Inferiore)

I **checkpoint** sono obiettivi specifici che l'AI deve raggiungere in ogni fase.

#### **Come Funzionano**

Ogni checkpoint viene **verificato automaticamente** dal sistema analizzando:

1. **Messaggio dell'utente**: La risposta che ha dato
2. **Keywords**: Parole chiave che indicano il completamento
3. **Sentiment**: Se la risposta è positiva/neutrale/negativa
4. **Evidenze**: Estratti del testo che provano il completamento

#### **Stati dei Checkpoint**

- **✓ Completato (Verde)**: Tutte le condizioni soddisfatte
- **⚠️ Dubbio (Arancione)**: Parzialmente completato, serve verifica manuale
- **○ Non Completato (Grigio)**: Non ancora raggiunto
- **✗ Fallito (Rosso)**: Tentato ma non soddisfatto

#### **Dettaglio Checkpoint**

Cliccando su un checkpoint espandi il dettaglio:

- **Domande richieste**: Cosa l'AI doveva chiedere
- **Evidenze Trovate**: Estratti del messaggio utente che provano il completamento
- **Keywords Matchate**: Parole chiave rilevate (es. "sì", "perfetto", "va bene")
- **Sentiment Score**: Quanto positiva/negativa era la risposta
- **Timestamp**: Quando è stato completato

---

## 🔍 Tecnica Ladder (3-5 PERCHÉ)

### Cos'è il Ladder?

Il **Ladder** è una tecnica di vendita che l'AI usa per scavare in profondità nelle risposte vaghe dell'utente, facendo domande di approfondimento successive (come una scala che scende).

### Come Funziona

1. **User risponde in modo vago**: "Voglio migliorare le vendite"
2. **AI chiede PERCHÉ (Ladder 1)**: "Perché vuoi migliorare le vendite?"
3. **User risponde ancora vagamente**: "Perché non sto raggiungendo i target"
4. **AI chiede PERCHÉ di nuovo (Ladder 2)**: "Che target specifico vuoi raggiungere?"
5. **Continua fino a 3-5 livelli** finché non ottiene una risposta concreta

### Badge Ladder

Nel pannello "Sales Script" vedrai badge come:

- **🔍 3x ✓**: Ladder attivato 3 volte (ottimo, range ideale 3-5)
- **🔍 6x ⚠️ Alto**: Ladder attivato 6 volte (troppo, rischio di stressare l'utente)
- **🔍 2x (1 vague)**: Ladder attivato 2 volte, di cui 1 con risposta ancora vaga (serve miglioramento)

---

## 📊 Anti-Regression Protection

### Cos'è?

La **protezione anti-regressione** impedisce all'AI di tornare indietro a fasi precedenti per errore.

### Come Funziona

Quando l'AI è in **Fase 3** e riceve un messaggio simile alla **Fase 1**, il sistema:

1. **Richiede una similarità molto alta (85%)** per tornare indietro
2. **Verifica che il numero di fase sia logico** (non salta 3 → 1 senza motivo)
3. **Esclude frasi generiche** (es. "sì", "ok") che potrebbero matchare tutto

Questo evita falsi positivi come:
- User dice "ciao" → AI non torna a FASE 1 (Apertura)
- User dice "ho capito" → AI non regredisce per keyword generica

---

## 🇮🇹 Language Filter (Italiano)

Il sistema ha un **filtro lingua automatico** che:

1. **Scarta transcript non italiani**: Se rileva parole spagnole/francesi
2. **Ignora caratteri non validi**: ?? o � (errori di encoding)
3. **Verifica ratio caratteri latini**: Se > 30% caratteri non-latini, scarta
4. **Forza AI a parlare italiano**: Prompt esplicito per usare solo italiano

Questo garantisce che le conversazioni siano sempre in italiano senza contaminazioni.

---

## 🎯 Tips per Analizzare una Conversazione

### 1. **Controlla la Visual Roadmap**
   
Guarda quante fasi sono state completate:
- **1-2 fasi**: Conversazione molto breve, probabilmente drop-off precoce
- **3-5 fasi**: Buona progressione, analizza dove si è fermata
- **6-7 fasi**: Conversazione completa, controlla chiusura

### 2. **Analizza i Ragionamenti AI**

Per ogni fase attivata:
- **Match alto (>80%)**: L'AI ha matchato correttamente il trigger semantico
- **Match medio (60-80%)**: Possibile falso positivo, verifica la domanda matchata
- **Keywords rilevanti**: Controlla se le parole chiave hanno senso

### 3. **Verifica i Checkpoint**

- **Tutti verdi**: Ottimo, l'AI ha raccolto tutte le info necessarie
- **Alcuni arancioni**: Serve follow-up manuale per completare
- **Molti grigi/rossi**: L'AI non ha fatto le domande giuste

### 4. **Monitora il Ladder**

- **Range 3-5**: Perfetto, giusta profondità senza stressare l'utente
- **< 3**: L'AI accetta risposte vaghe troppo facilmente
- **> 5**: L'AI è troppo insistente, rischio di perdere il prospect

### 5. **Identifica Drop-Off Point**

Se la conversazione si interrompe:
- **Fase 1-2**: Problema di apertura/rapport
- **Fase 3-4**: Discovery troppo lunga o invasiva
- **Fase 5-6**: Presentazione non convincente
- **Fase 7**: Problemi di chiusura/obiezioni

---

## 🚀 Best Practices

### Per Migliorare le Performance

1. **Analizza pattern di drop-off**: Se molte conversazioni si fermano alla stessa fase, rivedi lo script
2. **Ottimizza le domande**: Se certe domande non vengono mai fatte, rimuovile o semplificale
3. **Monitora i ladder**: Se troppo alti/bassi, aggiusta i parametri nel backend
4. **Verifica checkpoint**: Se sempre arancioni, le condizioni sono troppo strette
5. **Usa i ragionamenti**: Se l'AI attiva fasi sbagliate, rivedi le keyword dello script

### Per Training Efficace

1. **Confronta conversazioni simili**: Vedi cosa funziona e cosa no
2. **Traccia miglioramenti**: Monitora completion rate nel tempo
3. **A/B test**: Prova varianti dello script e confronta i risultati
4. **Focus sui checkpoint**: Sono gli indicatori più oggettivi di successo

---

## ❓ FAQ

**Q: Perché non vedo ragionamenti per una fase?**
A: Può essere che la fase non sia stata raggiunta, o che sia stata attivata automaticamente senza trigger semantico. Vedi la sezione "Empty State" sopra.

**Q: Cosa significa "Ladder 6x ⚠️ Alto"?**
A: L'AI ha fatto troppi tentativi di approfondimento (>5). Rischio di stressare l'utente. Ottimizza le domande per ottenere risposte più concrete.

**Q: Come capisco se un checkpoint è affidabile?**
A: Controlla le **evidenze** e il **sentiment score**. Se entrambi sono forti, il checkpoint è affidabile. Se solo uno, verifica manualmente.

**Q: Posso modificare lo script dalla Training Map?**
A: No, la Training Map è solo di lettura. Per modificare lo script devi andare nelle impostazioni dell'agente.

**Q: I dati sono in tempo reale?**
A: Sì, ogni conversazione viene analizzata in tempo reale e i dati sono immediatamente disponibili nella Training Map.

---

## 📞 Supporto

Per domande o problemi con la Training Map, contatta il supporto tecnico con:
- **Conversation ID**: Lo trovi nella URL della Training Map
- **Screenshot**: Se possibile, allega screenshot del problema
- **Descrizione**: Spiega cosa ti aspettavi vs cosa hai visto

---

**Ultimo aggiornamento**: Novembre 2025 • **Versione Script**: 1.0.0
