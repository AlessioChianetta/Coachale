# 📚 Guida al Block Editor - Script Manager

Benvenuto! Questa guida ti spiegherà come usare il nuovo **editor a blocchi modulare** per gestire i tuoi script di vendita (Discovery, Demo, Obiezioni) in modo visuale e strutturato.

---

## 🎯 Cosa Sono i "Blocchi"?

Invece di modificare uno script come **testo grezzo** (difficile da formattare, soggetto a errori), il Block Editor lo suddivide in **componenti logici e indipendenti**:

| Blocco | Cosa Contiene | Quando Lo Usi |
|--------|---------------|---------------|
| **📋 Regola Critica** | Divieti assoluti (es. "Non parlare di appuntamento prima di...") | All'inizio dello script |
| **📍 Fase** | Contenitore con numero + nome + descrizione | Raggruppa gli step (es. "Fase #1 - Apertura") |
| **⚡ Energia & Tonalità** | Livello energia, tono, volume, ritmo, vocabolario | Specifica come comportarsi in quella fase |
| **🎯 Step** | Numero, nome, obiettivo specifico | Unità di azione (es. "Step 1 - Saluto Entusiasta") |
| **📌 Domanda** | Testo domanda + istruzioni (Aspetta, Ascolta, Reagisci) | Ogni domanda da fare |
| **🍪 Biscottino** | Trigger + frase di recupero | Se il prospect divaga |
| **⛔ Checkpoint** | Checklist di verifica | Punto di controllo prima di procedere |
| **🔍 Ladder dei Perché** | Livelli 1-6 per scavare il vero problema | Domande progressive |
| **💬 Obiezione** | Titolo + varianti + reframe + domanda chiave | Solo negli script di Obiezioni |

---

## 🚀 Come Accedere all'Editor a Blocchi

### Step 1: Vai al Script Manager
1. Login come **Client**
2. Vai a **Sales Agents AI → Script Manager** (nella sidebar)

### Step 2: Seleziona uno Script
- Scegli dalla lista a sinistra (Discovery, Demo, o Obiezioni)
- Lo script si carica nel lato destro

### Step 3: Clicca su "Modifica"
- Pulsante **Modifica** in alto a destra
- L'editor si attiva

### Step 4: Scegli la Modalità Editor
Vedrai due pulsanti in alto:
- **🧩 Blocchi** ← **NUOVO EDITOR A BLOCCHI** (default)
- **💻 Testo** ← Editor testo classico

---

## 📖 Come Usare l'Editor a Blocchi

### 1️⃣ Visualizzare i Blocchi

L'editor mostra una lista di blocchi colorati:

```
🚨 Regola Critica: DIVIETO ASSOLUTO - NON PUOI PARLARE DI...
📍 FASE #1 - APERTURA ED IMPOSTAZIONE
  ├─ ⚡ ENERGIA & TONALITÀ
  ├─ 🎯 STEP 1 - APERTURA ENTUSIASTA
  │  ├─ 📌 DOMANDA: "Ciao [NOME_PROSPECT]! Benvenuto..."
  │  ├─ 📌 DOMANDA: "Senti, da dove mi chiami?"
  │  └─ 🍪 SE DIVAGA: "Ok tornando a noi..."
  └─ ⛔ CHECKPOINT OBBLIGATORIO FASE #1-2
📍 FASE #2 - ...
```

### 2️⃣ Espandere/Collassare i Blocchi

Ogni blocco ha un **triangolo ▶️ / ▼️** a sinistra:
- Clicca per **espandere** e visualizzare i dettagli
- Clicca di nuovo per **collassare**

### 3️⃣ Modificare un Blocco

Quando espandi un blocco, vedi i suoi **campi editabili**:

#### Esempio: Modificare una Domanda

**PRIMA di cliccare:**
```
📌 Domanda (Collassato)
   "Ciao [NOME_PROSPECT]! Come stai?"
```

**DOPO aver cliccato Modifica:**
```
📌 Domanda (Espanso - Modalità Edit)
   
   📝 Testo Domanda:
   [Input field] "Ciao [NOME_PROSPECT]! Come stai?"
   
   ⏸️ Aspetta Risposta: [✓ Checkbox]
   
   🎧 Istruzioni Ascolto:
   [Input field] "Ascolta con attenzione"
   
   💬 Reazioni Suggerite:
   [✓] "Fantastico!"
   [✓] "Alla grande!"
   [+] Aggiungi

   🔖 È domanda chiave? [Checkbox]
   
   🎯 Condizione (opzionale):
   [Input field] "SE NON È CHIARO"
```

### 4️⃣ Pulsanti di Azione

Ogni blocco ha pulsanti in alto a destra:

| Pulsante | Azione |
|----------|--------|
| **✏️ Modifica** | Apre il blocco in modalità edit |
| **💾 Salva** | Salva le modifiche del blocco |
| **❌ Annulla** | Scarta le modifiche non salvate |
| **🗑️ Elimina** | Rimuove il blocco (se non critico) |
| **⬆️ Sposta Su** | Cambia ordine |
| **⬇️ Sposta Giù** | Cambia ordine |

---

## 💡 Esempi Pratici

### Esempio 1: Modificare l'Energia di una Fase

**Vuoi cambaire da "MASSIMA" a "MEDIA"?**

1. Espandi **FASE #1**
2. Espandi **⚡ ENERGIA & TONALITÀ**
3. Clicca **Modifica**
4. Nel campo **Livello Energia**, seleziona **MEDIA** dal dropdown
5. Clicca **Salva**

✅ Fatto! L'energia della fase è aggiornata.

---

### Esempio 2: Aggiungere una Nuova Domanda a uno Step

**Vuoi aggiungere una domanda al Step 1?**

1. Espandi **FASE #1**
2. Espandi **🎯 STEP 1**
3. Clicca sul pulsante **➕ Aggiungi Domanda**
4. Compila i campi:
   - Testo: "La tua nuova domanda"
   - Istruzioni: "Cosa fare/ascoltare"
   - Reazioni: "Come reagire"
5. Clicca **Salva**

✅ La nuova domanda è aggiunta!

---

### Esempio 3: Cambiare la Frase del Biscottino

**Il prospect divaga e vuoi cambiare come redirezionarlo?**

1. Espandi **FASE #1 → STEP 1**
2. Espandi **🍪 BISCOTTINO**
3. Clicca **Modifica**
4. Cambia il campo **Frase**:
   ```
   "Ok, interessante! Tornando a noi..."
   ```
5. Clicca **Salva**

✅ La frase è aggiornata!

---

### Esempio 4: Modificare un Checkpoint

**Vuoi aggiungere un check al checkpoint della Fase #3?**

1. Espandi **FASE #3**
2. Espandi **⛔ CHECKPOINT**
3. Clicca **Modifica**
4. Nel campo **Checks**, aggiungi una nuova riga:
   ```
   ✓ Ho scavato il vero problema?
   ```
5. Clicca **Salva**

✅ Il checkpoint è aggiornato!

---

## 🔄 Passare tra Editor Blocchi e Testo

### Perché Potrebbe Servire?

- **Editor Blocchi**: Perfetto per modifiche strutturate, precise
- **Editor Testo**: Utile per copincolla veloce, riformattazioni massicce

### Come Switchare

In alto a destra (nella sezione Editor):

```
[🧩 Blocchi]  [💻 Testo]
```

**Clicca** sul pulsante che vuoi:
- Attivo: tasto blu
- Inattivo: tasto grigio

**Nota**: Quando switchi da Blocchi a Testo, il contenuto viene **rigenerato** dal blocco in testo formattato (con stessi emoji e formattazione).

---

## 💾 Salvare gli Script

### Pulsante "Salva"
Salva la versione corrente senza creare cronologia.

### Pulsante "Salva Nuova Versione"
Salva + crea un checkpoint nella cronologia (utile per tracciare cambiamenti).

**I blocchi vengono convertiti a testo** prima di essere salvati nel database, quindi il testo grezzo rimane disponibile come backup.

---

## ⚙️ Configurazione Avanzata

### Visualizzare Dati Nascosti

In alto a destra, clicca **⚙️ Impostazioni** per:
- Mostrare/nascondere campi opzionali
- Mostrare statistiche (# fasi, # step, # domande)
- Esportare come JSON (struttura pura)

### Cercare un Blocco

Usa il **🔍 Cerca** in alto per trovare:
- "Fatturato" → trova tutti i step che parlano di fatturato
- "Ladder" → mostra solo i ladder dei perché
- "Checkpoint" → mostra solo i checkpoint

---

## ❓ Domande Frequenti (FAQ)

### D: Se elimino un blocco per sbaglio, posso ripristinarlo?
**R**: Sì! Clicca **Annulla** subito, o torna a una versione precedente dalla **Cronologia Versioni** in basso.

---

### D: Posso duplicare un blocco (es. copiare uno Step)?
**R**: Sì! Espandi lo step, clicca sui **3 puntini ⋮** (menu) e seleziona **Duplica**. Si copia subito dopo.

---

### D: Che succede se salvo mentre sono in modalità Blocchi?
**R**: Il sistema converte i blocchi in testo (formato originale con emoji) e salva. Quando riapri, il testo viene ri-parsato in blocchi. È trasparente per te!

---

### D: Posso accedere all'editor a blocchi da mobile?
**R**: Sì, ma è ottimizzato per desktop. Su mobile potresti trovare l'editor leggermente compresso.

---

### D: Se creo una "Nuova Domanda" vuota e la salvo, cosa succede?
**R**: Il sistema ti avvisa che il testo è obbligatorio. Compila sempre il campo **Testo Domanda** prima di salvare.

---

## 🎯 Best Practices

### ✅ Fai Così:
1. **Modifica un blocco alla volta** - Salva prima di andare al prossimo
2. **Usa i Checkpoint** - Verifica ogni fase prima di procedere
3. **Prova il Testo** - Dopo aver modificato, switcha a **Testo** per vedere il risultato formattato
4. **Versiona Spesso** - Clicca **Salva Nuova Versione** per tracciare gli step importanti
5. **Usa i Biscottini** - Aggiungi frasi di recupero se il prospect divaga

### ❌ Evita:
1. **Non cancellare i Checkpoint** - Sono critici per guidare la call
2. **Non saltare gli Step** - Seguire l'ordine è importante
3. **Non modificare i Divieti Assoluti** - Quelli devono restare (es. "Non parlare di appuntamento prima di...")
4. **Non lasciare campi vuoti** - Se non servono, lascia la sezione collassata

---

## 🚀 Prossimi Step

1. **Apri uno script** nel Script Manager
2. **Switcha a Blocchi** se non già attivo
3. **Modifica il primo step** come esercizio
4. **Salva** e controlla il risultato nel **Testo**
5. **Attiva lo script** per usarlo negli AI Sales Agents

---

## 📞 Supporto

Se hai dubbi:
- Passa il mouse su **?** icon nei campi per descrizioni dettagliate
- Leggi il testo grigio sotto ogni campo (è la documentazione integrata)
- Prova il **Testo editor** per capire meglio la struttura

---

**Buona modifica! 🎉**

Ora gli script sono più facili da mantenere, meno soggetti a errori, e totalmente strutturati. Goditi il nuovo Block Editor!
