# DELIVERY & ONBOARDING — SISTEMA ORBITALE

## Processo Completo di Consegna del Servizio Post-Vendita

**Versione 1.0 — Marzo 2026**

---

# PARTE 1: OVERVIEW DEL PROCESSO DI DELIVERY

## 1.1 Principi Fondamentali

1. **Time to Value < 48h**: il cliente deve vedere il primo risultato (AI che risponde a un messaggio) entro 48 ore dalla firma
2. **Autonomia progressiva**: il cliente parte con approvazione manuale e scala all'autonomia solo quando è pronto
3. **Zero competenze tecniche**: ogni step è guidato, nessun momento "arrangiati"
4. **Documentazione viva**: tutto ciò che viene configurato è documentato e accessibile al cliente
5. **Handoff pulito**: il cliente deve essere in grado di gestire il sistema da solo dopo l'onboarding

## 1.2 Timeline per Livello

| Livello | Durata onboarding | Complessità | Touchpoint con il cliente |
|---------|-------------------|-------------|--------------------------|
| **Livello 1-3** | Self-service (0 giorni) | Bassa | 0 — il cliente fa da solo |
| **Livello 4** | 5-7 giorni lavorativi | Media | 3-4 call + configurazione assistita |
| **Livello 5** | 10-14 giorni lavorativi | Alta | 5-7 call + setup infrastruttura |
| **Livello 6** | 14-21 giorni lavorativi | Molto alta | 7-10 call + consulenza processi |

---

# PARTE 2: DELIVERY LIVELLO 1-3 (Self-Service)

## 2.1 Flusso Automatico

```
Cliente paga → Account creato automaticamente
        ↓
Email di benvenuto con credenziali
        ↓
Primo login → Setup Wizard guidato (4 fasi, 27 step)
        ↓
Fase 1: API Keys (Gemini)
Fase 2: Comunicazione (WhatsApp/SMTP)
Fase 3: Brand Voice
Fase 4: Primo agente AI
        ↓
AI Assistant attivo → cliente inizia a usare
```

## 2.2 Email Automatiche Post-Acquisto

| Timing | Email | Contenuto |
|--------|-------|-----------|
| Immediata | Benvenuto + credenziali | Login, password, link alla piattaforma |
| +1 giorno | Guida rapida | "3 cose da fare nei primi 10 minuti" — API Key, primo documento KB, primo agente |
| +3 giorni | Check-in | "Come sta andando? Hai completato il setup?" + link al Centro Guide |
| +7 giorni | Tips avanzati | "5 trucchi che i nostri clienti usano di più" — Knowledge Base, template, Brand Voice |
| +14 giorni | Proposta upgrade | "Vuoi che l'AI prenda anche gli appuntamenti? Scopri il Livello 4" |
| +30 giorni | Feedback | "Com'è andato il primo mese? Rispondi a questa email" |

---

# PARTE 3: DELIVERY LIVELLO 4 (Setter AI + Hunter) — PROCESSO DETTAGLIATO

## 3.1 Pre-Onboarding (prima della prima call)

### Checklist pre-call

Dopo la firma del contratto e il pagamento del setup (1.000€), inviare al cliente:

**Email pre-onboarding:**

> Oggetto: "Benvenuto in Sistema Orbitale — Ecco cosa ti serve per partire"
>
> Ciao [Nome],
>
> Benvenuto! Per preparare il tuo Dipendente AI, ho bisogno che mi mandi questi materiali entro la nostra prima call di [data]:
>
> 1. **FAQ del tuo business** — le 15-20 domande che ricevi più spesso dai clienti (con le risposte). Se non le hai scritte, scrivi quelle che ti vengono in mente.
>
> 2. **Listino servizi** — cosa offri, a chi, a quale prezzo. Anche in formato informale va bene.
>
> 3. **Documenti aziendali** — brochure, presentazioni, guide, manuali, procedure interne. Tutto ciò che descrive il tuo business. PDF, Word, anche foto di appunti.
>
> 4. **Esempi di conversazione** — screenshot di chat WhatsApp con clienti/lead. Mi servono per capire il tuo tono di voce naturale.
>
> 5. **Accessi** — Se hai già un account Twilio (per WhatsApp), Google Calendar, SMTP per le email. Se non ce li hai, li configuriamo insieme nella prima call.
>
> Non preoccuparti se non hai tutto perfetto — è un punto di partenza, lo raffiniamo insieme.
>
> A [giorno] alle [ora]!
>
> Alessio

### Materiali da preparare lato nostro

- [ ] Account creato nella piattaforma (Livello 4 attivo)
- [ ] Template onboarding preparato
- [ ] Calendario call bloccato (3-4 slot nei prossimi 7 giorni)
- [ ] Scheda cliente nel CRM con note dalla call di vendita

---

## 3.2 Call 1: Discovery & Setup Base (60 min)

### Agenda

**Blocco 1 — Discovery approfondita (20 min)**

Domande da fare:
1. "Raccontami il tuo business in 2 minuti — cosa fai, per chi, come ti trovano i clienti"
2. "Qual è il flusso tipico dal primo contatto alla vendita?"
3. "Su quali canali ricevi più messaggi? (WhatsApp, Instagram, email, telefono)"
4. "Quali sono le domande che ricevi più spesso?"
5. "Cosa NON deve mai dire l'AI? Ci sono argomenti sensibili, prezzi da non dare, competitor da non nominare?"
6. "Come vuoi che parli il Dipendente AI? Formale? Informale? Come parli tu con gli amici?"
7. "Qual è l'obiettivo della conversazione? Prendere l'appuntamento? Qualificare? Dare info?"
8. "Hai un calendario per le prenotazioni? Google Calendar? Altro?"

**Annotare tutto** — queste informazioni diventano il System Prompt e il Brand Voice.

**Blocco 2 — Setup tecnico (25 min)**

- [ ] Configurare API Key Gemini (condivisione schermo, passo-passo)
- [ ] Configurare Twilio/WhatsApp Business (se non già fatto)
- [ ] Configurare SMTP per email (se necessario)
- [ ] Collegare Google Calendar (per booking automatico)
- [ ] Caricare i primi documenti nella Knowledge Base:
  - FAQ → documento principale
  - Listino → documento servizi
  - Brochure/presentazioni → documenti di supporto
- [ ] Configurare Brand Voice (tono, stile, regole)

**Blocco 3 — Primo agente WhatsApp (15 min)**

- [ ] Creare l'agente WhatsApp inbound
- [ ] Scrivere il System Prompt insieme al cliente (basato sulla discovery)
- [ ] Collegare la Knowledge Base all'agente
- [ ] Fare il primo test: inviare un messaggio di prova e vedere la risposta
- [ ] Ottimizzare in tempo reale ("Mmm, qui dovrebbe dire X invece di Y")

**Homework per il cliente:**
- Mandare altri documenti che vengono in mente
- Fare 5-10 test all'agente con domande reali
- Annotare dove l'AI risponde bene e dove no

---

## 3.3 Call 2: Ottimizzazione & Hunter (45 min)

### Agenda

**Blocco 1 — Review test (15 min)**

- Analizzare i test fatti dal cliente
- Correggere le risposte che non funzionavano
- Aggiungere documenti/info mancanti alla KB
- Raffinare il System Prompt

**Blocco 2 — Configurazione Hunter (20 min)**

- [ ] Configurare il contesto commerciale per l'AI Scoring:
  - Servizi offerti (testo descrittivo)
  - Target ideale (chi cerca)
  - Proposta di valore
  - Vantaggi competitivi
  - Profilo cliente ideale
  - Approccio vendita
- [ ] Fare la prima ricerca lead:
  - Query (es. "commercialisti Milano")
  - Località
  - N risultati (iniziare con 10)
- [ ] Analizzare i risultati insieme:
  - Score AI — sono pertinenti?
  - Contatti disponibili — telefono, email, sito?
  - Qualità del profilo — il sito è aggiornato?
- [ ] Configurare Hunter:
  - Modalità (consigliata: Approvazione Manuale all'inizio)
  - Canali attivi (voice + WhatsApp + email)
  - Template WhatsApp per il primo contatto
  - Account email per l'outreach

**Blocco 3 — Configurazione Alessia Voice (10 min)**

Se il cliente ha un numero VoIP (o vuole acquistarlo):
- [ ] Verificare la configurazione Telnyx/SIP
- [ ] Configurare la voce (selezione tra le 6 voci disponibili)
- [ ] Configurare i template vocali (inbound + outbound)
- [ ] Fare una chiamata di test
- [ ] Configurare l'inactivity timeout e il messaggio di overflow

**Homework per il cliente:**
- Approvare/rifiutare i primi task di Hunter (se in modalità approvazione)
- Continuare a testare l'agente WhatsApp con clienti reali (prima 5 conversazioni)
- Annotare feedback

---

## 3.4 Call 3: Go-Live & Autonomia (30 min)

### Agenda

**Blocco 1 — Review risultati (10 min)**

- Analizzare le prime conversazioni reali dell'agente
- Analizzare i primi contatti di Hunter (se attivi)
- Misurare: risposte corrette vs da correggere
- Ultimi aggiustamenti al System Prompt e alla KB

**Blocco 2 — Attivazione autonomia (10 min)**

- Se le risposte sono affidabili al 90%+:
  - [ ] Alzare il livello di autonomia da 2 (approvazione) a 4 (esecuzione automatica)
  - [ ] Configurare gli orari di lavoro dei dipendenti AI
  - [ ] Attivare i canali (voice, email, WhatsApp) in modalità autonoma
  - [ ] Configurare i limiti giornalieri (max task/giorno)

- Se le risposte hanno ancora problemi:
  - [ ] Restare in modalità approvazione per altri 3-5 giorni
  - [ ] Pianificare una call 4 di follow-up

**Blocco 3 — Formazione autonomia (10 min)**

Insegnare al cliente:
- Come leggere la dashboard dei task
- Come approvare/rifiutare/modificare i task
- Come aggiungere documenti alla Knowledge Base
- Come bloccare un dipendente AI su un cliente specifico
- Come monitorare le conversazioni WhatsApp e le chiamate vocali
- Dove trovare il Centro Guide per l'auto-aiuto

**Deliverable finale:**
- Email di riepilogo con tutto ciò che è stato configurato
- Link al Centro Guide
- Contatto diretto per supporto (email/WhatsApp)
- Promemoria check-in a 7 e 30 giorni

---

## 3.5 Check-in Post-Onboarding

| Timing | Formato | Contenuto |
|--------|---------|-----------|
| **+7 giorni** | Email + opzionale call 15 min | "Come sta andando? Ci sono domande?" — analisi primi 7 giorni di attività AI |
| **+14 giorni** | Email | Metriche: lead gestiti, conversazioni, appuntamenti prenotati |
| **+30 giorni** | Call 30 min | Review completa primo mese: cosa funziona, cosa migliorare, KPI |
| **+60 giorni** | Email | Proposta upgrade se c'è fit (Livello 5/6) |
| **+90 giorni** | Call 15 min | Check trimestrale: evoluzione, nuove esigenze, retention |

---

# PARTE 4: DELIVERY LIVELLO 5 (Enterprise & Partnership)

## 4.1 Timeline Dettagliata (10-14 giorni)

```
Giorno 1-2:   Call 1 — Discovery aziendale approfondita
Giorno 3-4:   Setup infrastruttura + documentazione massiva
Giorno 5:     Call 2 — Review configurazione + primo agente
Giorno 6-7:   Setup Hunter + Voice + Email Hub
Giorno 8:     Call 3 — Test con team del cliente
Giorno 9-10:  Call 4 — Configurazione partnership/rivendita
Giorno 11-12: Test periodo + raffinamento
Giorno 13-14: Call 5 — Go-live + formazione autonomia
```

## 4.2 Call 1: Discovery Aziendale (90 min)

Tutto ciò del Livello 4, più:

**Blocco extra — Analisi team e reparti (30 min)**

1. "Quanti dipendenti hai? Quali reparti?"
2. "Per ogni reparto: quali sono i task ripetitivi? Quanto tempo ci dedicano?"
3. "Quali reparti potrebbero beneficiare di un assistente AI dedicato?"
4. "Hai documenti separati per reparto? (procedure operative, script vendita, manuali tecnici)"
5. "Chi sarà l'admin della piattaforma oltre a te?"

**Blocco extra — Modello partnership (15 min — se rivendita)**

1. "Vuoi rivendere l'AI ai tuoi clienti?"
2. "Quanti clienti hai a cui potresti offrirla?"
3. "A quale prezzo pensi di rivenderla?"
4. "Hai già Stripe configurato?"

## 4.3 Setup Infrastruttura (Giorni 3-4)

- [ ] Knowledge Base completa: tutti i documenti dell'azienda caricati e indicizzati
- [ ] Organizzazione per reparto (cartelle/tag)
- [ ] System Prompt Documents per ogni dipendente AI
- [ ] Brand Voice avanzato con:
  - Tono e stile personale
  - Personalità dei contenuti
  - Linguaggio del target
  - Pattern da evitare
  - Esempi di scrittura reali
  - Frasi firma
- [ ] Tutti i 9 dipendenti AI configurati:
  - Alessia (voice) con template vocali
  - Millie (email) con profilo commerciale per-account
  - Stella (WhatsApp) con template per scenario
  - Echo (riepiloghi) collegato alle consulenze
  - Nova (social) con calendario editoriale
  - Marco (coaching) con obiettivi strategici
  - Hunter con contesto commerciale completo
  - Personalizza con istruzioni per reparto
- [ ] Email Hub configurato con IMAP/SMTP
- [ ] Voice configurato con numero VoIP

## 4.4 Call Extra: Configurazione Partnership (45 min)

Solo per clienti che vogliono rivendere:

- [ ] Setup Stripe Connect (wizard 3 step)
- [ ] Configurazione piani (Silver, Gold, Custom)
- [ ] Definizione prezzi per il cliente finale
- [ ] Test link di pagamento
- [ ] Configurazione automazioni post-pagamento:
  - Attivazione automatica account
  - Email di benvenuto personalizzata
  - Assegnazione livello e contenuti
- [ ] Formazione su come gestire i clienti finali

---

# PARTE 5: DELIVERY LIVELLO 6 (Enterprise + Consulenza Strategica)

## 5.1 Tutto il Livello 5, più:

### Consulenza Processi Aziendali (3-5 call aggiuntive)

**Call A — Mappatura Processi (90 min)**

Analisi completa dei processi aziendali:
1. Flusso vendita end-to-end (dal lead alla chiusura)
2. Flusso assistenza clienti (dal ticket alla risoluzione)
3. Flusso onboarding nuovi clienti
4. Flusso onboarding nuovi dipendenti
5. Flusso operativo quotidiano (cosa fa ogni reparto)

Per ogni processo:
- Identificare i colli di bottiglia
- Identificare i task ripetitivi automatizzabili
- Identificare le inefficienze
- Misurare il tempo dedicato

**Call B — Raccomandazioni Software (60 min)**

Basandosi sulla mappatura:
- Quale software manca nell'infrastruttura (CRM, project management, billing, ecc.)
- Come integrare Sistema Orbitale con i tool esistenti
- Quali processi automatizzare prioritariamente
- Roadmap di implementazione a 90 giorni

**Call C — Piano Strategico AI (60 min)**

- Quali dipendenti AI attivare per primo e perché
- Come misurare il ROI per reparto
- Timeline di adozione progressiva
- KPI da monitorare

**Call D-E — Follow-up implementazione (30 min ciascuna)**

- Review dell'avanzamento
- Risoluzione problemi
- Aggiustamenti alla strategia

### Deliverable Livello 6

- Documento "Analisi Processi Aziendali" (PDF personalizzato)
- Roadmap implementazione 90 giorni
- Raccomandazioni software con priorità
- Configurazione completa di tutti i moduli
- Accesso prioritario al supporto

---

# PARTE 6: GESTIONE PROBLEMI POST-ONBOARDING

## 6.1 Problemi Comuni e Soluzioni

| Problema | Causa | Soluzione | Chi lo risolve |
|----------|-------|-----------|---------------|
| "L'AI risponde cose sbagliate" | KB incompleta o System Prompt vago | Aggiungere documenti, raffinare prompt | Supporto + cliente |
| "I lead non rispondono al messaggio WhatsApp" | Template poco engaging o timing sbagliato | Testare nuovi template, cambiare orario | Supporto |
| "Hunter trova lead non pertinenti" | Contesto commerciale troppo generico | Raffinare query di ricerca e profilo target | Supporto + cliente |
| "Troppi task generati" | Autonomia troppo alta, frequenza troppo alta | Abbassare autonomia a 2-3, aumentare frequenza | Cliente (guidato) |
| "Il cliente ha paura di lasciare l'AI autonoma" | Normale — trust building richiede tempo | Restare in approvazione più a lungo, mostrare metriche positive | Supporto |
| "Alessia Voice non parla bene" | Template vocale generico | Usare "Migliora con AI", aggiungere contesto specifico | Supporto |
| "Il team del cliente non usa la piattaforma" | Formazione insufficiente o resistenza al cambiamento | Call di formazione dedicata al team | Supporto (L5/L6) |
| "Il cliente vuole funzionalità che non esistono" | Aspettative disallineate | Verificare nella roadmap, comunicare tempistiche | Account manager |

## 6.2 Escalation Matrix

| Livello | Chi gestisce | Tempo di risposta | Canale |
|---------|-------------|-------------------|--------|
| **Tier 1 — FAQ / How-to** | Centro Guide + AI Assistant | Self-service immediato | Piattaforma |
| **Tier 2 — Configurazione** | Supporto tecnico | <24h lavorative | Email/WhatsApp |
| **Tier 3 — Bug/Problema tecnico** | Team tecnico | <4h lavorative | Email con priorità |
| **Tier 4 — Strategico/Consulenziale** | Account manager (solo L5/L6) | <48h lavorative | Call schedulata |

---

# PARTE 7: UPSELL & RETENTION

## 7.1 Trigger di Upsell

| Da | A | Trigger | Messaggio |
|----|---|---------|-----------|
| L1 | L2 | 7 giorni di uso attivo | "Ti piace? Con L2 hai messaggi illimitati a 47€/mese" |
| L2 | L3 | Chiede corsi o voce | "Con L3 hai corsi, voce AI e memoria a 97€/mese" |
| L3 | L4 | Chiede booking o lead gen | "Con L4 il Setter AI prende appuntamenti + Hunter trova lead a 497€/mese" |
| L4 | L5 | >3 mesi attivo + buoni risultati | "Vuoi offrire questo ai tuoi clienti? Con L5 guadagni il 35-50% MRR" |
| L5 | L6 | Chiede consulenza processi | "Con L6 hai consulenza strategica dedicata a 1.997€/mese" |

## 7.2 Azioni di Retention

| Timing | Azione | Obiettivo |
|--------|--------|-----------|
| **Settimanale** | Email con metriche (lead gestiti, tempo risparmiato) | Mostrare valore tangibile |
| **Mensile** | Report automatico via Echo + suggerimenti di ottimizzazione | Mantenere engagement |
| **Trimestrale** | Call review con account manager (L4+) | Identificare nuove esigenze, prevenire churn |
| **Semestrale** | Analisi ROI completa | Giustificare il rinnovo con numeri |
| **Al rinnovo** | Email personale con risultati ottenuti | Ridurre churn al rinnovo |

## 7.3 Segnali di Churn

| Segnale | Azione preventiva |
|---------|-------------------|
| Login diminuiti (da quotidiano a settimanale) | Email "Ci sei mancato" + call check-in |
| Task AI rifiutati sistematicamente | Call per riconfigurare i dipendenti AI |
| KB non aggiornata da >30 giorni | Suggerire di aggiungere nuovi documenti |
| Nessun nuovo lead in Hunter da >14 giorni | Proporre nuove ricerche/query |
| Ticket di supporto ripetuti sullo stesso tema | Formazione dedicata sull'argomento |
| Cliente dice "non uso più X" | Capire perché, riconfigurare o disattivare (ridurre frustrazione) |

---

# PARTE 8: TEMPLATE EMAIL POST-VENDITA

## 8.1 Email di Benvenuto (Livello 4)

**Oggetto:** "Benvenuto in Sistema Orbitale — Il tuo Dipendente AI ti aspetta"

> Ciao [Nome],
>
> Benvenuto in Sistema Orbitale! Sono felice di averti a bordo.
>
> Ecco cosa succede adesso:
>
> **Prossima call:** [Data] alle [Ora] — 60 minuti per configurare il tuo primo Dipendente AI
>
> **Cosa ti serve preparare:**
> 1. Le 15-20 domande che i tuoi clienti fanno più spesso (con le risposte)
> 2. Il tuo listino servizi (anche informale)
> 3. Qualsiasi documento che descrive il tuo business (PDF, brochure, presentazioni)
> 4. Screenshot di 3-5 conversazioni WhatsApp con clienti (per capire il tuo tono)
>
> Non serve che sia perfetto — è un punto di partenza, raffiniamo tutto insieme.
>
> **Nel frattempo:**
> - Il tuo account è già attivo su [link piattaforma]
> - Login: [email] / Password: [password]
> - Puoi esplorare la piattaforma, ma non configurare nulla — lo facciamo insieme
>
> A [giorno]!
>
> Alessio

---

## 8.2 Email Post-Call 1

**Oggetto:** "Riepilogo call + prossimi passi"

> Ciao [Nome],
>
> Ottima prima call! Ecco cosa abbiamo fatto:
>
> **Configurato:**
> - [X] API Key Gemini
> - [X] WhatsApp Business (Twilio)
> - [X] Knowledge Base con [N] documenti
> - [X] Brand Voice ([tono scelto])
> - [X] Primo agente WhatsApp "[Nome agente]"
>
> **Il tuo homework per i prossimi 3 giorni:**
> 1. Testa l'agente con 5-10 domande reali (manda messaggi dal tuo telefono personale)
> 2. Annota dove risponde bene e dove no
> 3. Se ti vengono in mente altri documenti/FAQ, mandameli
>
> **Prossima call:** [Data] alle [Ora] — ottimizziamo le risposte + configuriamo Hunter
>
> Alessio

---

## 8.3 Email Go-Live

**Oggetto:** "Il tuo Dipendente AI è LIVE — Ecco cosa monitorare"

> Ciao [Nome],
>
> Il tuo Dipendente AI è ufficialmente attivo! Ecco cosa monitorare nei prossimi 7 giorni:
>
> **Dashboard da controllare ogni giorno (5 minuti):**
> - Tab "Task" in AI Autonomo → vedi cosa fanno i dipendenti AI
> - Tab "Chiamate" → ascolta le registrazioni delle chiamate di Hunter
> - WhatsApp → leggi le conversazioni dell'agente
>
> **Se qualcosa non va:**
> - L'AI dice qualcosa di sbagliato → mandami lo screenshot, correggiamo il System Prompt
> - Troppe notifiche → abbassiamo la frequenza dei dipendenti AI
> - Lead non pertinenti → raffiniamo il contesto commerciale di Hunter
>
> **Check-in tra 7 giorni:** ti mando un'email con le metriche della prima settimana.
>
> **Supporto diretto:** rispondi a questa email o scrivimi su WhatsApp al [numero].
>
> In bocca al lupo!
>
> Alessio

---

## 8.4 Email Metriche 7 Giorni

**Oggetto:** "I tuoi primi 7 giorni con l'AI — I numeri"

> Ciao [Nome],
>
> Ecco i numeri della tua prima settimana:
>
> **Risultati:**
> - Lead gestiti dall'AI: [N]
> - Conversazioni WhatsApp automatiche: [N]
> - Appuntamenti prenotati: [N]
> - Chiamate vocali effettuate: [N]
> - Tempo medio di risposta: [X] secondi
>
> **Cosa funziona bene:**
> - [Esempio positivo]
>
> **Cosa possiamo migliorare:**
> - [Suggerimento]
>
> Vuoi fare una call di 15 minuti per ottimizzare? [Link booking]
>
> Alessio

---

# PARTE 9: CHECKLIST OPERATIVE

## 9.1 Checklist Pre-Onboarding (da completare prima della Call 1)

- [ ] Account cliente creato nella piattaforma
- [ ] Livello corretto assegnato
- [ ] Email di benvenuto inviata
- [ ] Calendario call bloccato
- [ ] Note dalla call di vendita riviste
- [ ] Materiali ricevuti dal cliente (FAQ, listino, documenti)
- [ ] Template onboarding pronto

## 9.2 Checklist Call 1 — Setup Base

- [ ] API Key Gemini configurata
- [ ] Twilio/WhatsApp configurato
- [ ] SMTP configurato (se serve email)
- [ ] Google Calendar collegato (se serve booking)
- [ ] Almeno 3 documenti nella Knowledge Base
- [ ] Brand Voice configurato
- [ ] Primo agente WhatsApp creato e testato
- [ ] System Prompt scritto e validato con il cliente
- [ ] Homework assegnato al cliente
- [ ] Email post-call inviata

## 9.3 Checklist Call 2 — Hunter & Voice

- [ ] Review feedback test del cliente
- [ ] System Prompt raffinato
- [ ] KB aggiornata con nuovi documenti
- [ ] Contesto commerciale Hunter configurato
- [ ] Prima ricerca lead effettuata
- [ ] Hunter configurato (modalità, canali, template)
- [ ] Alessia Voice configurata (se applicabile)
- [ ] Template vocali impostati
- [ ] Chiamata di test effettuata
- [ ] Email post-call inviata

## 9.4 Checklist Call 3 — Go-Live

- [ ] Review conversazioni reali
- [ ] Ultimi aggiustamenti prompt/KB
- [ ] Livello autonomia impostato (2 o 4)
- [ ] Orari di lavoro configurati
- [ ] Limiti giornalieri impostati
- [ ] Formazione cliente su dashboard/task/KB
- [ ] Email go-live inviata
- [ ] Check-in +7 giorni schedulato
- [ ] Check-in +30 giorni schedulato

## 9.5 Checklist Livello 5 — Extra

- [ ] Tutti i 9 dipendenti AI configurati
- [ ] KB organizzata per reparto
- [ ] System Prompt Documents per dipendente
- [ ] Email Hub con IMAP/SMTP
- [ ] Brand Voice avanzato (stile personale, pattern evitare, frasi firma)
- [ ] Stripe Connect configurato (se partnership)
- [ ] Piani vendita creati (Silver, Gold, Custom)
- [ ] Automazioni post-pagamento attive
- [ ] Team del cliente formato
- [ ] Admin account del cliente configurato

## 9.6 Checklist Livello 6 — Extra

- [ ] Mappatura processi aziendali completata
- [ ] Documento "Analisi Processi" consegnato
- [ ] Raccomandazioni software documentate
- [ ] Roadmap 90 giorni consegnata
- [ ] Piano strategico AI per reparto
- [ ] KPI per reparto definiti
- [ ] Follow-up implementazione schedulato

---

# PARTE 10: KPI DI DELIVERY

## 10.1 Metriche di Successo dell'Onboarding

| Metrica | Target | Come misurarla |
|---------|--------|---------------|
| **Time to First Value** | <48h | Tempo tra firma e prima risposta AI a un lead reale |
| **Time to Full Setup** | <7gg (L4), <14gg (L5) | Tempo tra firma e go-live completo |
| **Setup Completion Rate** | >95% | % clienti che completano tutto l'onboarding |
| **NPS Post-Onboarding** | >8/10 | Survey dopo call 3 |
| **First Month Retention** | >95% | % clienti ancora attivi dopo 30 giorni |
| **Time to Autonomy** | <14 giorni | Tempo tra go-live e passaggio a autonomia ≥4 |

## 10.2 Metriche di Successo del Cliente (Primo Mese)

| Metrica | Target L4 | Target L5 |
|---------|-----------|-----------|
| Lead gestiti dall'AI | >50 | >100 |
| Conversazioni automatiche | >30 | >60 |
| Appuntamenti prenotati | >5 | >10 |
| Tasso di risposta corretta | >90% | >90% |
| Tempo medio risposta | <10 sec | <10 sec |
| Chiamate vocali (se voice attivo) | >20 | >50 |
| Documenti in KB | >10 | >30 |

## 10.3 Metriche di Retention

| Metrica | Target | Azione se sotto target |
|---------|--------|----------------------|
| Churn rate mensile | <5% | Analisi causa + call rescue |
| Churn rate trimestrale | <10% | Review processo onboarding |
| Upgrade rate (L4→L5) | >10% | Proposta upgrade a 90 giorni |
| Referral rate | >15% | Programma referral incentivato |
| LTV medio | >6.000€ | Focus su retention + upsell |
