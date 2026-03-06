# Guida Completa ai 10 Pacchetti Servizio della Piattaforma

Questa guida contiene il contenuto formativo articolato per ogni pacchetto servizio. Ogni sezione è pensata come una lezione approfondita dell'Accademia, non un semplice tutorial di configurazione ma una spiegazione completa del perché, del come e della strategia d'uso.

---

# PACCHETTO 1: SETTER AI — Acquisizione & Primo Contatto

## Lezione 1.1: Come funziona il Setter AI

Il Setter AI è il tuo primo punto di contatto automatico con i potenziali clienti. Immagina di avere un collaboratore instancabile che risponde istantaneamente a ogni messaggio WhatsApp o Instagram, 24 ore su 24, 7 giorni su 7 — qualificando i lead, rispondendo alle domande frequenti e prenotando appuntamenti nel tuo calendario.

**Il problema che risolve:**
La maggior parte dei consulenti perde lead perché non riesce a rispondere in tempo. Un potenziale cliente scrive alle 22:00, tu rispondi la mattina dopo, e nel frattempo ha già contattato un competitor. Il Setter AI elimina questo problema: risponde in secondi, non in ore.

**Come funziona il flusso:**

Il Setter AI opera attraverso gli agenti WhatsApp e Instagram della piattaforma. Quando un lead ti contatta:

1. L'agente lo accoglie con un messaggio personalizzato basato sul tuo System Prompt
2. Fa domande di qualifica per capire se è un lead valido (budget, urgenza, bisogno)
3. Consulta la tua Knowledge Base (File Search) per dare risposte precise e specifiche sul tuo business
4. Se il lead è qualificato, propone di fissare un appuntamento e lo prenota direttamente nel tuo Google Calendar
5. Ti invia una notifica con il riepilogo della conversazione

**I due tipi di agente:**

- **Inbound**: risponde ai messaggi in arrivo. Il lead ti scrive per primo (da sito web, social, passaparola). L'agente lo accoglie e lo qualifica.
- **Outbound**: contatta proattivamente i lead. Tu selezioni chi contattare (da CRM, import CSV, Lead Scraper), e l'agente invia il primo messaggio.

**Cosa lo rende intelligente:**

Il Setter AI non è un chatbot con risposte predefinite. Usa Gemini AI con accesso alla tua Knowledge Base, al tuo System Prompt e (se il cliente è Gold) alla memoria delle conversazioni precedenti. Questo significa che può rispondere a domande specifiche sul tuo business che un chatbot tradizionale non potrebbe gestire.

**Dove trovarlo:** Sidebar → AI AVANZATO → WhatsApp Agents

## Lezione 1.2: Configurare il primo agente inbound

Creare il tuo primo agente inbound è il passo fondamentale per automatizzare l'acquisizione clienti. Ecco come farlo nel modo giusto, evitando gli errori più comuni.

**Prerequisiti:**
Prima di creare l'agente, assicurati di avere:
- Twilio configurato con un numero WhatsApp Business (Setup Base → Twilio)
- API Key Gemini attiva (Setup Base → Vertex AI)
- Knowledge Base popolata con almeno i documenti fondamentali del tuo business

**Passo 1 — Crea l'agente:**
Vai su Sidebar → AI AVANZATO → WhatsApp Agents e clicca "Nuovo Agente". Scegli il tipo "Inbound" e assegnagli un nome riconoscibile (es. "Assistente Principale").

**Passo 2 — Configura il System Prompt:**
Questo è il cuore dell'agente. Il System Prompt definisce la personalità, le regole e il comportamento. Scrivi istruzioni chiare e specifiche:
- Chi sei (nome azienda, settore, cosa offri)
- Come deve parlare (tono formale/informale, lunghezza risposte)
- Cosa NON deve fare (non dare prezzi, non parlare di competitor)
- Come qualificare (quali domande fare, cosa cercare)
- Quando proporre l'appuntamento

**Passo 3 — Collega la Knowledge Base:**
Attiva il File Search sull'agente e assicurati che i documenti chiave siano indicizzati: listino prezzi, FAQ, descrizione servizi, casi studio. Più informazioni dai all'agente, più risposte precise potrà dare.

**Passo 4 — Testa l'agente:**
Prima di andare live, testa l'agente mandandogli messaggi dal tuo telefono personale. Simula diverse situazioni: domande generiche, richieste di prezzo, obiezioni, richiesta appuntamento. Verifica che le risposte siano appropriate e il tono sia quello giusto.

**Passo 5 — Genera il link pubblico:**
Una volta soddisfatto, genera il link pubblico dell'agente (wa.me/numero) e inseriscilo nel tuo sito web, nelle bio dei social, nei biglietti da visita. Ogni click su quel link avvia una conversazione con il tuo Setter AI.

**Errori comuni da evitare:**
- System Prompt troppo generico ("Sei un assistente utile") → sii specifico sul tuo business
- Knowledge Base vuota → l'agente inventerà le risposte
- Non testare prima di andare live → potresti perdere lead reali

**Dove trovarlo:** Sidebar → AI AVANZATO → WhatsApp Agents

## Lezione 1.3: Strategia di qualifica lead

Avere un agente AI che risponde è solo l'inizio. La vera potenza sta nel configurarlo per qualificare i lead in modo intelligente, separando chi è pronto a comprare da chi sta solo curiosando.

**Il framework BANT adattato all'AI:**

La qualifica tradizionale usa BANT (Budget, Authority, Need, Timeline). Con il Setter AI, puoi automatizzare questo processo:

- **Budget**: l'agente chiede indirettamente il range di investimento previsto, senza sembrare aggressivo
- **Authority**: verifica se la persona è il decisore o deve consultare qualcun altro
- **Need**: identifica il problema specifico che il lead vuole risolvere
- **Timeline**: capisce quando vuole iniziare (urgente, entro un mese, sta solo esplorando)

**Come implementarlo nel System Prompt:**

Inserisci istruzioni come: "Dopo i primi 2-3 messaggi di conversazione, fai queste domande in modo naturale: 1) Qual è la sfida principale che stai affrontando? 2) Hai già provato altre soluzioni? 3) Entro quando vorresti risolvere questo problema? 4) Quante persone sono coinvolte nella decisione?"

**Il punteggio di qualifica:**

Quando il Setter AI raccoglie queste informazioni, il sistema le registra nella conversazione. Tu puoi poi vedere il riepilogo nella dashboard WhatsApp e decidere la priorità. I lead con alta urgenza e budget chiaro vanno contattati subito. Quelli "freddi" vanno nel nurturing automatico.

**Integrazione con il funnel:**

Il Setter AI non lavora da solo. Si integra con:
- **Email Nurturing** (Pacchetto 4): i lead non pronti vengono inseriti in una sequenza email automatica
- **Hunter** (Pacchetto 3): i lead trovati dal Lead Scraper possono essere contattati dal Setter AI in modalità outbound
- **Stripe** (Pacchetto 9): i lead qualificati possono ricevere un link di pagamento diretto

**Dove trovarlo:** Sidebar → AI AVANZATO → WhatsApp Agents → System Prompt dell'agente

---

# PACCHETTO 2: DIPENDENTI AI AUTONOMI — Team AI 24/7

## Lezione 2.1: I 9 Dipendenti AI — Chi sono e cosa fanno

La piattaforma include 9 dipendenti AI, ognuno specializzato in un'area specifica del tuo business. Non sono chatbot generici: sono agenti autonomi che analizzano, pianificano e agiscono senza il tuo intervento.

**I 9 Dipendenti:**

1. **Stella** — Gestione Clienti: analizza lo stato dei clienti, identifica chi ha bisogno di attenzione, invia messaggi WhatsApp di check-in e follow-up
2. **Marco** — Strategia e KPI: monitora le metriche del business, identifica trend, suggerisce azioni strategiche basate sui dati
3. **Millie** — Email & Comunicazione: genera bozze email, gestisce le risposte automatiche, classifica la posta in arrivo per priorità
4. **Luna** — Social & Content: analizza i trend dei social media, suggerisce idee per contenuti, monitora l'engagement
5. **Alex** — Appuntamenti & Agenda: gestisce il calendario, invia reminder, riprogramma appuntamenti, organizza la giornata lavorativa
6. **Sara** — Formazione & Corsi: monitora il progresso formativo dei clienti, suggerisce contenuti da creare, identifica gap nelle competenze
7. **Tomas** — Analisi Finanziaria: traccia ricavi, costi, margini. Identifica clienti profittevoli e aree di miglioramento
8. **Nina** — Customer Success: monitora la soddisfazione dei clienti, identifica chi rischia di abbandonare, suggerisce azioni di retention
9. **Hunter** — Lead Generation: cerca nuovi lead, arricchisce i contatti esistenti, avvia il primo contatto automatico

**Come lavorano:**

Ogni 30 minuti (durante l'orario lavorativo configurato), il sistema di AI Autonomy lancia un ciclo di analisi. Ogni dipendente:
1. Analizza i dati disponibili (clienti, email, appuntamenti, metriche)
2. Identifica situazioni che richiedono attenzione
3. Genera un task con azione proposta (es. "Invia messaggio WhatsApp a Mario Rossi per follow-up")
4. Il task viene eseguito automaticamente OPPURE messo in coda per la tua approvazione (a seconda della configurazione)

**Perché è diverso da un semplice reminder:**

Un reminder ti dice "chiama il cliente". Un dipendente AI analizza PERCHÉ dovresti chiamare quel cliente specifico, COSA dirgli (basandosi sulle conversazioni precedenti), e QUANDO è il momento migliore. Poi, se glielo permetti, lo fa direttamente.

**Dove trovarlo:** Sidebar → AI AVANZATO → AI Autonomo

## Lezione 2.2: Attivare e configurare l'AI Autonomo

L'AI Autonomo è il motore che fa funzionare i 9 dipendenti. Senza attivarlo, i dipendenti restano "dormienti". Ecco come configurarlo correttamente.

**Passo 1 — Attiva l'autonomia:**
Vai su Sidebar → AI AVANZATO → AI Autonomo. Troverai un interruttore principale ON/OFF. Attivalo per abilitare i cicli automatici.

**Passo 2 — Configura l'orario lavorativo:**
Imposta le fasce orarie in cui i dipendenti possono operare. Di default è 08:00-20:00, fuso orario Europa/Roma. I dipendenti NON faranno azioni fuori da questo orario (non invieranno messaggi WhatsApp alle 3 di notte).

**Passo 3 — Scegli la modalità:**
- **Autonomia completa**: i dipendenti eseguono le azioni senza chiederti conferma. Ideale quando hai fiducia nel sistema e vuoi massima automazione.
- **Approvazione richiesta**: i task vengono generati ma messi in coda. Tu li approvi o rifiuti dalla dashboard. Ideale all'inizio, per capire come ragionano i dipendenti.

**Passo 4 — Personalizza ogni dipendente:**
Puoi attivare o disattivare singoli dipendenti. Se non hai bisogno di analisi finanziaria, disattiva Tomas. Se non vuoi messaggi WhatsApp automatici, disattiva Stella. Ogni dipendente ha le sue impostazioni specifiche.

**Passo 5 — Configura i canali:**
Per ogni dipendente, definisci COME può agire:
- WhatsApp: può inviare messaggi ai clienti
- Email: può generare e inviare email
- Task interni: crea task nella piattaforma che vedi nella dashboard
- Chiamate vocali: può programmare chiamate con Alessia AI

**Monitoraggio:**
Nella dashboard AI Autonomo vedi in tempo reale:
- Quanti task sono stati generati oggi
- Quanti sono stati eseguiti vs in attesa
- Quali dipendenti sono più attivi
- Log dettagliato di ogni azione

**Dove trovarlo:** Sidebar → AI AVANZATO → AI Autonomo

## Lezione 2.3: Monitorare e gestire i task AI

Una volta attivato l'AI Autonomo, i dipendenti iniziano a generare task. Saper leggere la dashboard e gestire i task è fondamentale per ottenere il massimo dal sistema.

**La Dashboard Task:**

Nella pagina AI Autonomo trovi la lista di tutti i task generati, con:
- **Dipendente**: chi ha generato il task (Stella, Marco, ecc.)
- **Tipo azione**: WhatsApp, email, task interno, chiamata
- **Descrizione**: cosa vuole fare il dipendente e perché
- **Stato**: in attesa, approvato, eseguito, fallito, rifiutato
- **Data/ora**: quando è stato generato e (se eseguito) quando è stato completato

**Come leggere un task:**

Ogni task contiene il ragionamento del dipendente. Esempio:
"Stella ha analizzato che il cliente Mario Rossi non ha interagito con la piattaforma da 14 giorni. L'ultimo appuntamento era 3 settimane fa. Propongo di inviargli un messaggio WhatsApp di check-in: 'Ciao Mario, come sta andando con [argomento dell'ultimo incontro]? Ho alcune novità che potrebbero interessarti.'"

**Azioni possibili:**
- **Approva**: il task viene eseguito immediatamente
- **Rifiuta**: il task viene scartato (il dipendente impara dai rifiuti nel tempo)
- **Modifica**: puoi cambiare il testo del messaggio prima di approvarlo
- **Rinvia**: rimanda l'esecuzione a una data/ora specifica

**Best practice:**
- Le prime 2 settimane, usa la modalità "Approvazione richiesta" per capire il comportamento dei dipendenti
- Rifiuta i task che non ti convincono — il sistema migliora nel tempo
- Controlla la dashboard almeno una volta al giorno
- Se un dipendente genera troppi task inutili, rivedi il suo prompt e le sue istruzioni

**Dove trovarlo:** Sidebar → AI AVANZATO → AI Autonomo → Tab Task

---

# PACCHETTO 3: HUNTER — Lead Generation & Outreach

## Lezione 3.1: Come funziona il Lead Scraper

Il Lead Scraper è il motore di ricerca che trova nuovi potenziali clienti per te. Cerca su Google Maps le attività che corrispondono ai tuoi criteri, le arricchisce con dati pubblici e le presenta in un CRM dedicato pronto per il contatto.

**Il flusso completo:**

1. **Tu definisci la ricerca**: tipo di attività (es. "ristoranti"), zona geografica (es. "Milano centro"), numero di risultati desiderati
2. **Il sistema cerca su Google Maps**: trova le attività corrispondenti con nome, indirizzo, telefono, sito web, recensioni, orari
3. **Arricchimento automatico**: per ogni attività trovata, il sistema visita il sito web e analizza la presenza online (ha un sito moderno? È attivo sui social? Ha un e-commerce?)
4. **Scoring AI**: un'intelligenza artificiale assegna un punteggio di "fit" — quanto è probabile che questa attività abbia bisogno dei tuoi servizi
5. **CRM Lead Scraper**: tutti i lead trovati finiscono in un CRM dedicato dove puoi filtrarli, ordinarli e decidere chi contattare

**Cosa rende il sistema potente:**

Non è un semplice elenco di nomi e numeri. Per ogni lead hai:
- **Informazioni di base**: nome, indirizzo, telefono, email (se disponibile), sito web
- **Analisi della presenza online**: il sistema ha visitato il sito web e analizzato cosa funziona e cosa no
- **Punteggio di fit**: da 1 a 10, quanto questo lead è adatto ai tuoi servizi
- **Suggerimento di contatto**: l'AI suggerisce come approcciare questo lead specifico

**Integrazione con il resto della piattaforma:**

I lead trovati dal Lead Scraper possono essere:
- Contattati automaticamente da Hunter (il dipendente AI) via WhatsApp
- Inseriti in una campagna di email nurturing
- Chiamati da Alessia AI (Voice)
- Importati nel CRM principale come contatti CRM

**Dove trovarlo:** Sidebar → LEAD GENERATION → Lead Scraper

## Lezione 3.2: Configurare una ricerca lead

Configurare bene la ricerca è la differenza tra trovare lead qualificati e sprecare tempo con contatti irrilevanti.

**Passo 1 — Definisci il target:**
Nella pagina Lead Scraper, clicca "Nuova Ricerca". Inserisci:
- **Query**: cosa cerchi (es. "studio dentistico", "palestra crossfit", "agenzia immobiliare"). Sii specifico: "ristorante sushi" è meglio di "ristorante".
- **Località**: la zona geografica (es. "Roma EUR", "Milano Brera", "Napoli Vomero"). Più precisa è la zona, più rilevanti saranno i risultati.
- **Raggio**: il raggio di ricerca in km.
- **Numero risultati**: quanti lead vuoi trovare (10, 25, 50, 100).

**Passo 2 — Avvia la ricerca:**
Clicca "Avvia" e il sistema inizia a cercare. Il processo richiede qualche minuto perché per ogni risultato il sistema visita il sito web e analizza la presenza online. Puoi chiudere la pagina e tornare più tardi — la ricerca continua in background.

**Passo 3 — Analizza i risultati:**
Quando la ricerca è completata, trovi i lead nel CRM Lead Scraper con tutti i dettagli. Ordina per punteggio di fit (i lead con punteggio più alto sono quelli più promettenti) e inizia a lavorare da quelli.

**Consigli pratici:**
- Fai ricerche specifiche e localizzate piuttosto che generiche e ampie
- Usa il punteggio di fit come guida, non come verdetto assoluto
- I lead con sito web datato o assenza di social sono spesso i più bisognosi dei tuoi servizi
- Salva le ricerche che funzionano bene per ripeterle periodicamente

**Dove trovarlo:** Sidebar → LEAD GENERATION → Lead Scraper

## Lezione 3.3: Gestire i lead e avviare il contatto

Una volta che hai i lead, il passo successivo è contattarli. La piattaforma offre diversi canali di contatto, ognuno adatto a situazioni diverse.

**Il CRM Lead Scraper:**

Ogni lead nel CRM ha una scheda dettagliata con:
- Informazioni di contatto (telefono, email, sito)
- Analisi della presenza online (cosa funziona, cosa manca)
- Punteggio di fit con motivazione
- Storico dei contatti (se già contattato, come è andata)

**Canali di contatto disponibili:**

1. **WhatsApp via Hunter (automatico)**: il dipendente AI Hunter può contattare i lead automaticamente via WhatsApp con un messaggio personalizzato. Attiva Hunter nella modalità "Diretto" per farlo partire ogni 30 minuti.

2. **Campagna WhatsApp (batch)**: seleziona più lead e lancia una campagna di contatto massivo. Ogni messaggio è personalizzato dall'AI per quel lead specifico.

3. **Chiamata vocale Alessia AI**: per i lead ad alto punteggio, puoi programmare una chiamata vocale automatica. Alessia AI chiama il lead, si presenta, e qualifica l'interesse.

4. **Email**: se hai l'email del lead, puoi inserirlo in una sequenza di email nurturing automatica.

5. **Manuale**: puoi sempre contattare il lead manualmente — il sistema ti fornisce le informazioni e i suggerimenti, tu decidi come procedere.

**Pipeline di contatto consigliata:**

Per massimizzare i risultati, usa una strategia multi-canale:
- Giorno 1: messaggio WhatsApp personalizzato (via Hunter o campagna)
- Giorno 3: se non risponde, email di follow-up
- Giorno 7: chiamata vocale con Alessia AI
- Giorno 14: secondo messaggio WhatsApp con contenuto di valore

**Dove trovarlo:** Sidebar → LEAD GENERATION → Lead Scraper → CRM

---

# PACCHETTO 4: EMAIL JOURNEY & NURTURING — Comunicazione Continuativa

## Lezione 4.1: Come funziona il Nurturing Email

Il nurturing è l'arte di mantenere viva la relazione con un lead nel tempo, fino a quando è pronto a comprare. La piattaforma automatizza questo processo con email personalizzate generate dall'AI.

**Il problema che risolve:**

La maggior parte dei lead non compra al primo contatto. Servono in media 7-12 interazioni prima che una persona sia pronta all'acquisto. Senza nurturing, quei lead si dimenticano di te. Con il nurturing, resti nella loro mente con contenuti utili e pertinenti.

**Come funziona il sistema:**

Il Nurturing Email 365 genera automaticamente una sequenza di email per un intero anno, personalizzate per il tuo settore e il tuo target. L'AI crea:

- **Email educative**: insegni qualcosa di utile al lead (tips, strategie, case study)
- **Email di valore**: condividi risorse, guide, checklist
- **Email di social proof**: mostri risultati ottenuti con altri clienti
- **Email di conversione**: proponi un'azione specifica (consulenza gratuita, demo, offerta)

**La cadenza:**

Le email vengono inviate con una cadenza predefinita (es. ogni 3 giorni, ogni settimana) configurabile. Il sistema rispetta gli orari di invio appropriati e non invia email nel weekend (a meno che tu non lo configuri diversamente).

**Personalizzazione AI:**

Ogni email è personalizzata per il singolo lead. Se l'AI ha informazioni sul lead (settore, dimensione azienda, problema principale), le usa per rendere il messaggio rilevante. Non sono email generiche uguali per tutti.

**Dove trovarlo:** Sidebar → IMPOSTAZIONI → AI Config → Tab Lead Nurturing

## Lezione 4.2: Creare la prima sequenza email

La prima sequenza email è la più importante: definisce il tono e la qualità della comunicazione con i tuoi lead. Ecco come configurarla.

**Passo 1 — Configura l'Email Journey:**
Vai su Sidebar → IMPOSTAZIONI → AI Config → Tab AI Email. Qui configuri il comportamento post-consulenza:
- **Modalità bozza**: l'AI genera l'email ma non la invia. Tu la rivedi e approvi dalla dashboard.
- **Modalità automatica**: l'AI genera e invia l'email automaticamente. Ideale quando hai fiducia nel sistema.

L'Email Journey si attiva dopo ogni consulenza: l'AI genera un riepilogo dell'incontro e lo invia al cliente, con i punti chiave discussi e i prossimi passi concordati.

**Passo 2 — Configura il Nurturing 365:**
Vai su Sidebar → IMPOSTAZIONI → AI Config → Tab Lead Nurturing. Qui imposti:
- **Settore**: il tuo settore di attività (l'AI adatta il tono e i contenuti)
- **Target**: a chi scrivi (imprenditori, professionisti, aziende, privati)
- **Tono**: formale, informale, consulenziale, motivazionale
- **Obiettivo**: cosa vuoi che il lead faccia alla fine (prenotare consulenza, acquistare, richiedere demo)

Clicca "Genera Sequenza" e l'AI crea 365 email in pochi minuti. Puoi revisionarle, modificarle o rigenerarle.

**Passo 3 — Collega l'Email Hub:**
Per inviare email, devi avere l'Email Hub configurato (Sidebar → COMUNICAZIONE → Email Hub). Collega il tuo account email IMAP/SMTP e verifica che l'invio funzioni.

**Passo 4 — Assegna i lead:**
I lead vengono automaticamente inseriti nella sequenza di nurturing quando:
- Vengono importati nel CRM
- Completano una conversazione con un agente WhatsApp senza convertire
- Vengono aggiunti manualmente

**Dove trovarlo:** Sidebar → IMPOSTAZIONI → AI Config → Tab AI Email / Lead Nurturing

## Lezione 4.3: Email Hub — Gestire inbox e risposte AI

L'Email Hub è il centro di comando per tutte le email della piattaforma. Non è solo un client email: integra AI per la classificazione, la prioritizzazione e le risposte automatiche.

**Funzionalità principali:**

1. **Inbox unificata**: vedi tutte le email in arrivo da tutti gli account collegati in un'unica vista
2. **Classificazione AI (Millie)**: ogni email viene classificata automaticamente per priorità (urgente, normale, bassa) e tipo (richiesta informazioni, complaint, follow-up, spam)
3. **Risposte AI suggerite**: per ogni email, l'AI genera una bozza di risposta che puoi modificare e inviare con un click
4. **Risposte automatiche**: per alcune categorie di email (FAQ, richieste standard), l'AI può rispondere automaticamente senza il tuo intervento
5. **Collegamento CRM**: le email dei clienti nel CRM vengono automaticamente collegate al loro profilo

**Come collegare un account:**
Vai su Sidebar → COMUNICAZIONE → Email Hub → "Aggiungi Account". Inserisci:
- Server IMAP (per la ricezione)
- Server SMTP (per l'invio)
- Email e password
Il sistema verifica la connessione e inizia a sincronizzare le email.

**Millie — La dipendente AI delle email:**
Millie è una dei 9 dipendenti AI, specializzata nelle email. Quando l'AI Autonomo è attivo, Millie:
- Analizza le email non lette e le classifica per priorità
- Genera bozze di risposta per le email più urgenti
- Ti segnala email che richiedono attenzione immediata
- Gestisce le risposte automatiche per le richieste standard

**Dove trovarlo:** Sidebar → COMUNICAZIONE → Email Hub

---

# PACCHETTO 5: LAVORO QUOTIDIANO — Operatività

## Lezione 5.1: Dashboard e KPI

La dashboard è il tuo cruscotto quotidiano: una vista rapida su tutto ciò che conta nel tuo business. Non devi cercare le informazioni — la dashboard te le presenta.

**Cosa trovi nella dashboard:**

- **Clienti attivi**: quanti clienti hai e come sono distribuiti (Silver, Gold)
- **Appuntamenti oggi/settimana**: cosa hai in agenda
- **Lead in pipeline**: quanti lead stai gestendo e a che punto sono
- **Task AI in attesa**: azioni suggerite dai dipendenti AI che richiedono la tua approvazione
- **Email non lette**: contatore delle email in arrivo non gestite
- **Metriche WhatsApp**: messaggi inviati/ricevuti, conversazioni attive
- **Revenue**: fatturato del mese (se Stripe Connect è configurato)

**Come usarla nella routine quotidiana:**

La dashboard è pensata per una revisione di 5 minuti la mattina:
1. Controlla gli appuntamenti del giorno
2. Rivedi i task AI in attesa (approva o rifiuta)
3. Verifica le email urgenti segnalate da Millie
4. Controlla i lead nuovi dal Lead Scraper
5. Dai un'occhiata alle metriche settimanali

**Personalizzazione:**
Puoi personalizzare quali widget vedere nella dashboard e in quale ordine. Le metriche si aggiornano in tempo reale.

**Dove trovarlo:** Sidebar → LAVORO QUOTIDIANO → Dashboard

## Lezione 5.2: Gestire appuntamenti e calendario

Il sistema di gestione appuntamenti della piattaforma si integra con Google Calendar per offrirti una vista unificata e strumenti di automazione.

**Funzionalità principali:**

1. **Sincronizzazione bidirezionale**: gli appuntamenti creati nella piattaforma appaiono nel tuo Google Calendar e viceversa
2. **Booking AI**: gli agenti WhatsApp possono prenotare appuntamenti direttamente nel tuo calendario, verificando la disponibilità in tempo reale
3. **Reminder automatici**: il sistema invia promemoria WhatsApp ai clienti prima dell'appuntamento (24h, 1h prima — configurabile)
4. **Riepilogo post-consulenza**: dopo ogni appuntamento, puoi generare un riepilogo AI della consulenza e inviarlo al cliente via email (Email Journey)
5. **Video meeting integrato**: se hai configurato il TURN server (Metered.ca), puoi fare videochiamate direttamente dalla piattaforma

**Come configurare il booking automatico:**

Per permettere agli agenti AI di prenotare appuntamenti:
1. Collega Google Calendar (Setup Base → Google Calendar)
2. Nell'agente WhatsApp, abilita la funzione "Calendario"
3. L'agente verificherà la tua disponibilità e proporrà gli slot liberi al lead
4. Quando il lead conferma, l'appuntamento viene creato automaticamente

**Dove trovarlo:** Sidebar → LAVORO QUOTIDIANO → Appuntamenti

## Lezione 5.3: CRM — Gestire clienti e contatti

Il CRM della piattaforma è il cuore della gestione clienti. Qui trovi tutti i tuoi clienti, lead e contatti CRM con le loro informazioni, lo storico delle interazioni e gli strumenti per gestirli.

**Tipi di contatto:**

1. **Clienti attivi (Gold/Silver)**: hanno un account con login, accesso alla piattaforma, consumano una licenza
2. **Contatti CRM**: non hanno login, non consumano licenze. Sono lead in fase di conversione — puoi generare link di pagamento Stripe per convertirli in clienti

**Funzionalità del CRM:**

- **Vista lista**: tutti i contatti con filtri per tipo (clienti, CRM), stato, livello (Silver, Gold)
- **Profilo cliente**: scheda dettagliata con informazioni personali, storico conversazioni WhatsApp, email, appuntamenti, task AI, progresso formativo
- **Note e tag**: aggiungi note e tag per organizzare i contatti
- **Azioni rapide**: dal menu contestuale puoi inviare WhatsApp, email, generare link pagamento, assegnare corsi, programmare chiamate

**Contatti CRM e conversione:**

Il flusso più importante è la conversione CRM → Cliente:
1. Crea un contatto CRM (nome + email, senza password)
2. Genera un link di pagamento Stripe (scegli piano Silver/Gold)
3. Invia il link al contatto
4. Quando paga, il sistema lo converte automaticamente in cliente con login

Questo flusso è descritto in dettaglio nel Pacchetto 9 (Pagamenti & Stripe).

**Dove trovarlo:** Sidebar → LAVORO QUOTIDIANO → Clienti

---

# PACCHETTO 6: FORMAZIONE & CORSI — Academy

## Lezione 6.1: Creare un corso per i tuoi clienti

La piattaforma include un sistema completo di formazione (University) che ti permette di creare corsi strutturati per i tuoi clienti. È uno degli strumenti più potenti per posizionarti come esperto e aumentare il valore percepito dei tuoi servizi.

**Struttura dei corsi:**

I corsi sono organizzati in una gerarchia:
- **Anno** (es. "Anno 1 — Fondamenti"): il contenitore principale
- **Trimestre** (es. "Q1 — Mindset"): raggruppa i moduli per periodo
- **Modulo** (es. "Gestione del Tempo"): un argomento specifico
- **Lezione** (es. "La matrice di Eisenhower"): il contenuto singolo con video, testo e materiali allegati

**Come creare il primo corso:**

1. Vai su Sidebar → FORMAZIONE → Gestione Corsi
2. Crea un "Anno" (es. "Percorso Base")
3. Aggiungi un "Trimestre" (es. "Modulo Iniziale")
4. Crea i moduli con le lezioni
5. Per ogni lezione puoi aggiungere: titolo, descrizione, contenuto scritto, video (YouTube, Vimeo, Wistia), documenti allegati (PDF, slide)
6. Assegna il corso ai clienti dalla lista clienti

**Generazione AI dei corsi:**

Se non vuoi partire da zero, l'AI University Generator può creare un intero percorso formativo basandosi sui documenti della tua Knowledge Base. Carica i tuoi materiali e l'AI li organizza in un corso strutturato con moduli e lezioni.

**Tracciamento del progresso:**

Ogni cliente ha una dashboard formativa con:
- Barra di avanzamento per ogni modulo
- Lezioni completate vs da completare
- Tempo stimato rimanente
- Certificato di completamento (opzionale)

**Dove trovarlo:** Sidebar → FORMAZIONE → Gestione Corsi

## Lezione 6.2: Esercizi pratici e valutazione

Gli esercizi sono la componente pratica della formazione. Permettono ai tuoi clienti di applicare ciò che hanno imparato e a te di valutare il loro progresso.

**Tipi di esercizi:**

- **Testo libero**: il cliente scrive una risposta aperta (es. "Descrivi la tua strategia di marketing per il prossimo mese")
- **Domande a risposta multipla**: quiz con risposte predefinite
- **Caso studio**: il cliente analizza un caso reale e propone una soluzione
- **Compito pratico**: il cliente deve fare un'azione concreta e documentarla (es. "Crea la tua prima campagna email e allega lo screenshot")

**Correzione AI:**

Quando un cliente completa un esercizio a testo libero o caso studio, l'AI può:
- Analizzare la risposta e assegnare un punteggio
- Fornire feedback dettagliato su cosa è stato fatto bene e cosa migliorare
- Suggerire risorse aggiuntive per approfondire

Tu puoi poi rivedere la correzione AI, modificarla se necessario, e approvare il voto finale.

**Gamification:**

Gli esercizi completati contribuiscono al sistema di gamification:
- Punti per ogni esercizio completato
- Badge per milestone raggiunte
- Classifica tra i clienti
- Livelli di progressione

**Dove trovarlo:** Sidebar → FORMAZIONE → Esercizi

## Lezione 6.3: Gamification e motivazione

La gamification è il sistema che tiene i tuoi clienti motivati e coinvolti nel percorso formativo. Non è un gioco — è una strategia provata per aumentare il completamento dei corsi e l'engagement complessivo.

**Elementi di gamification:**

1. **Punti esperienza (XP)**: i clienti guadagnano punti completando lezioni, esercizi, e raggiungendo obiettivi. I punti sono visibili nel loro profilo.

2. **Livelli**: al raggiungere determinate soglie di XP, i clienti salgono di livello (es. Principiante → Intermedio → Avanzato → Esperto). Ogni livello sblocca nuovi contenuti o funzionalità.

3. **Badge/Achievement**: riconoscimenti speciali per milestone (es. "Prima lezione completata", "10 esercizi superati", "Corso completato al 100%").

4. **Classifica**: una leaderboard che mostra i clienti più attivi. Stimola la competizione sana e l'engagement.

5. **Streak**: giorni consecutivi di attività. Più lunga la streak, più punti bonus.

**Perché funziona:**

La gamification sfrutta i meccanismi psicologici di:
- **Progresso visibile**: la barra di avanzamento e i livelli mostrano al cliente quanto ha fatto e quanto gli manca
- **Ricompensa immediata**: i punti e i badge danno gratificazione istantanea
- **Confronto sociale**: la classifica crea un senso di comunità e competizione
- **Impegno crescente**: una volta iniziata una streak, il cliente è motivato a non interromperla

**Come configurarla:**

La gamification si attiva automaticamente per i clienti Gold. Puoi personalizzare i punti assegnati per ogni azione e i livelli nella sezione Gamification.

**Dove trovarlo:** Sidebar → FORMAZIONE → Gamification

---

# PACCHETTO 7: CONTENT STUDIO — Marketing & Contenuti

## Lezione 7.1: AdVisage AI — La fabbrica creativa

AdVisage AI è il motore creativo della piattaforma. Genera concept pubblicitari completi — copy, direzione visiva, varianti per piattaforma — in pochi secondi. Non sostituisce un grafico, ma ti dà le idee e le bozze su cui lavorare.

**Come funziona:**

1. **Inserisci il brief**: descrivi il prodotto/servizio da promuovere, il target, l'obiettivo della campagna
2. **Scegli mood + stile**: il Multi-Style Engine combina 8 mood (Energico, Elegante, Provocatorio, Rassicurante, Urgente, Minimalista, Lusso, Giocoso) con 8 stili artistici (Fotorealistico, Illustrazione, Flat Design, Vintage, Neon, Acquerello, 3D Render, Collage)
3. **Genera i concept**: l'AI crea concept completi con copy principale, visual direction, call-to-action, e adattamento per piattaforma (Instagram, Facebook, LinkedIn, TikTok)
4. **Rivedi e seleziona**: valuta i concept generati, modifica quelli che ti convincono, scarta gli altri

**Il Pitch Mode:**

Quando hai dei concept pronti, il Pitch Mode crea una presentazione professionale da mostrare ai clienti:
- Slideshow navigabile con ogni concept + razionale creativo
- Il cliente può commentare e approvare direttamente
- Export in formato presentazione per meeting

**Batch Analysis:**

Se il tuo cliente ha già dei post pubblicati, AdVisage AI può analizzarli in massa per identificare pattern di successo: quali tipi di post funzionano meglio, quali orari hanno più engagement, quali formati generano più interazioni. Usa questi dati per guidare la strategia futura.

**Dove trovarlo:** Sidebar → CONTENT STUDIO → AdVisage AI

## Lezione 7.2: Ideas Generator e calendario editoriale

L'Ideas Generator è il brainstorming AI che ti aiuta a non rimanere mai senza idee per i contenuti. Genera idee per post, articoli, video e campagne basandosi sul tuo settore e il tuo target.

**Come funziona:**

1. Vai su Sidebar → CONTENT STUDIO → Ideas
2. Inserisci il contesto: settore, target, obiettivo della comunicazione
3. L'AI genera una lista di idee per contenuti con: titolo, angolo creativo, piattaforma consigliata, formato (post, reel, carosello, articolo)
4. Seleziona le idee che ti piacciono e spostale nel calendario editoriale

**Il calendario editoriale:**

Una volta selezionate le idee, puoi organizzarle in un calendario:
- Vista settimanale/mensile
- Assegna data e orario di pubblicazione
- Aggiungi note e brief per ogni contenuto
- Traccia lo stato (idea → in lavorazione → pronto → pubblicato)

**Integrazione con Publer:**

Se usi Publer per la pubblicazione dei contenuti, la piattaforma si integra direttamente:
- Esporta i contenuti da AdVisage/Ideas verso Publer
- Schedula la pubblicazione su più piattaforme contemporaneamente
- Monitora le performance dei post pubblicati

**Dove trovarlo:** Sidebar → CONTENT STUDIO → Ideas

## Lezione 7.3: Pubblicare e monitorare con Publer

Publer è la piattaforma di social media management integrata nella piattaforma tramite gli Orbitale Tools. Ti permette di pubblicare su Instagram, Facebook, LinkedIn, Twitter e altre piattaforme da un'unica interfaccia.

**Integrazione con la piattaforma:**

L'integrazione con Publer funziona in due direzioni:

1. **Export da AdVisage/Ideas → Publer**: i contenuti generati dall'AI possono essere esportati direttamente verso Publer per la schedulazione e la pubblicazione
2. **Sync delle metriche Publer → Piattaforma**: il polling periodico (ogni 5 minuti) sincronizza lo stato dei post pubblicati (pubblicato, schedulato, fallito) con la piattaforma

**Flusso operativo consigliato:**

1. Genera idee con Ideas Generator
2. Crea i concept visivi con AdVisage AI
3. Esporta verso Publer
4. Schedula la pubblicazione sulle piattaforme del cliente
5. Monitora le performance dalla dashboard

**Dove trovarlo:** Sidebar → CONTENT STUDIO → Ideas (export) + Orbitale → Publer (gestione diretta)

---

# PACCHETTO 8: VOCE AI — Centralino & Chiamate

## Lezione 8.1: Alessia AI — Le chiamate vocali

Alessia AI è l'agente vocale della piattaforma. Può fare e ricevere chiamate telefoniche in totale autonomia, con una voce naturale e la capacità di gestire conversazioni complesse.

**Cosa può fare Alessia:**

- **Chiamate outbound**: chiama i lead per qualificarli, presentare servizi, confermare appuntamenti
- **Centralino AI**: risponde alle chiamate in arrivo, smista verso la persona giusta, gestisce FAQ vocali
- **Prenotazione appuntamenti**: durante la chiamata può verificare la disponibilità del calendario e prenotare direttamente
- **Follow-up automatici**: dopo la chiamata, può inviare un riepilogo via WhatsApp o email

**Come funziona tecnicamente:**

Alessia utilizza un sistema VoIP basato su Telnyx/FreeSWITCH:
1. La chiamata viene avviata (outbound) o ricevuta (inbound) sul numero VoIP configurato
2. L'audio viene trasmesso in tempo reale a Gemini AI che gestisce la conversazione
3. Gemini genera le risposte vocali basandosi sul System Prompt, la Knowledge Base e le istruzioni specifiche
4. A fine chiamata, il sistema genera una trascrizione completa e un riepilogo

**Template vocali:**

Puoi creare template per diversi tipi di chiamate:
- **Qualifica lead**: "Buongiorno, sono Alessia di [azienda]. La contatto perché ha mostrato interesse per [servizio]..."
- **Conferma appuntamento**: "Buongiorno, la chiamo per confermare il suo appuntamento di [data] alle [ora]..."
- **Follow-up post-consulenza**: "Buongiorno, la chiamo per un breve follow-up dopo il nostro incontro di [data]..."

Ogni template definisce il flusso della conversazione, gli obiettivi (cosa deve ottenere la chiamata) e le informazioni da raccogliere.

**Dove trovarlo:** Sidebar → AI AVANZATO → Chiamate Vocali

## Lezione 8.2: Centralino AI e coda d'attesa

Il Centralino AI trasforma il tuo numero di telefono in una reception intelligente. Risponde alle chiamate, capisce cosa vuole l'interlocutore e agisce di conseguenza.

**Funzionalità del centralino:**

1. **Risposta automatica**: il centralino risponde immediatamente a ogni chiamata con un messaggio di benvenuto personalizzato
2. **Riconoscimento intento**: Alessia AI capisce cosa vuole l'interlocutore (informazioni, appuntamento, reclamo, emergenza)
3. **Routing intelligente**: in base all'intento, la chiamata viene gestita direttamente da Alessia o trasferita a te
4. **Messaggi fuori orario**: fuori dall'orario lavorativo, il centralino informa l'interlocutore e raccoglie un messaggio
5. **Coda d'attesa**: se sei impegnato, le chiamate vengono messe in coda con musica d'attesa e aggiornamenti sulla posizione

**Brand Voice:**

Puoi personalizzare la voce e il tono del centralino per riflettere il brand della tua azienda:
- Tono formale/informale
- Velocità della voce
- Lingua (italiano, inglese, altre)
- Frase di benvenuto personalizzata

**Dove trovarlo:** Sidebar → AI AVANZATO → Chiamate Vocali → Centralino

## Lezione 8.3: Provisioning numeri VoIP

Per usare le chiamate vocali e il centralino, hai bisogno di un numero di telefono VoIP. La piattaforma si integra con Telnyx per l'acquisto e la configurazione dei numeri.

**Come funziona:**

1. **Vai alla pagina Numeri Telefono**: Sidebar → IMPOSTAZIONI → Numeri Telefono
2. **Cerca numeri disponibili**: il sistema cerca numeri disponibili nella tua zona geografica (Italia, altri paesi)
3. **Acquista il numero**: seleziona il numero che preferisci e confermalo. Il costo è gestito dal tuo account Telnyx.
4. **Configurazione automatica**: il sistema configura automaticamente il numero per funzionare con il centralino AI e le chiamate outbound
5. **Verifica**: fai una chiamata di test al numero per verificare che Alessia risponda correttamente

**Requisiti:**
- Account Telnyx con credito disponibile
- API Key Telnyx configurata nella piattaforma (Sidebar → IMPOSTAZIONI → API Keys → Tab Telnyx)
- SIP credentials configurate (il sistema le genera automaticamente)

**Costi:**
I costi dei numeri VoIP e delle chiamate dipendono dal provider Telnyx:
- Numero italiano: circa €1-2/mese
- Chiamata in uscita: circa €0.01-0.03/minuto
- Chiamata in entrata: generalmente gratuita

**Dove trovarlo:** Sidebar → IMPOSTAZIONI → Numeri Telefono

---

# PACCHETTO 9: PAGAMENTI & STRIPE — Monetizzazione e Rivendita Licenze

## Lezione 9.1: Il modello di business — Diamond, Gold, Silver

Questo è il pacchetto più strategico della piattaforma: è ciò che trasforma la piattaforma da uno strumento di lavoro in una fonte di reddito ricorrente.

**Il modello di business in sintesi:**

Tu hai una **Licenza Diamond** — l'accesso completo a tutti i moduli della piattaforma. Puoi rivendere l'accesso ai tuoi clienti sotto forma di licenze **Gold** e **Silver**, al prezzo che decidi tu. Ogni pagamento viene diviso automaticamente: il 50% va a te, il 50% va al Fornitore della piattaforma.

**Le tre licenze nel dettaglio:**

**Diamond (la tua)**
- Accesso completo a TUTTI i moduli: AI Suite, Dipendenti AI, Content Studio, Voice AI, Lead Scraper, CRM, Stripe Connect, Gestione Team, Corsi, Analytics
- Puoi creare clienti, gestire licenze, configurare agenti AI, generare report
- È la licenza "padrone" — tutto il potere di configurazione e gestione

**Gold (per i tuoi clienti premium)**
- AI Assistant con memoria persistente (ricorda tutto delle conversazioni precedenti)
- Accesso a corsi ed esercizi
- Agente WhatsApp dedicato
- Knowledge Base (File Search)
- Analytics avanzate
- Gamification (punti, livelli, classifiche)
- Tutti i contenuti formativi creati da te

**Silver (per i tuoi clienti base)**
- AI Assistant SENZA memoria (ogni conversazione riparte da zero)
- Funzionalità base della piattaforma
- Accesso limitato ai corsi
- Niente gamification avanzata

**Perché conviene:**

Facciamo un esempio concreto. Se vendi 20 licenze Gold a €100/mese ciascuna:
- Fatturato mensile: €2.000
- La tua quota (50%): €1.000/mese
- La quota del Fornitore (50%): €1.000/mese
- Il tuo guadagno annuale da sole licenze: €12.000
- Tutto automatico, ogni mese, per sempre

E questo si AGGIUNGE ai tuoi compensi per la consulenza, che NON sono soggetti a revenue sharing.

**Cosa è soggetto a revenue sharing:**
- Canoni mensili/annuali delle licenze (Silver, Gold, Custom)
- Costi di attivazione addebitati ai clienti
- Servizi aggiuntivi legati alla piattaforma (add-on)

**Cosa NON è soggetto:**
- I tuoi servizi professionali (consulenza, coaching, formazione esterna alla piattaforma)
- Attività commerciali esterne

**Dove trovarlo:** Sidebar → IMPOSTAZIONI → Stripe Connect

## Lezione 9.2: Configurare Stripe Connect

Stripe Connect è il motore tecnico che gestisce i pagamenti e lo split automatico. Ecco come configurarlo passo-passo.

**Prerequisiti:**
- Un account Stripe (se non ce l'hai, crealo su stripe.com — è gratuito)
- Documento d'identità per la verifica (richiesta da Stripe per normativa antiriciclaggio)

**Il wizard di onboarding ha 3 step:**

**Step 1 — Connetti Account Stripe Express:**
Clicca "Connetti Stripe" nella pagina Stripe Connect. Verrai reindirizzato a Stripe dove:
- Crei un account Express (tipo semplificato per chi riceve pagamenti da piattaforme)
- Completi la verifica identità (carica un documento, inserisci dati anagrafici)
- Torni automaticamente alla piattaforma quando hai finito

L'account Express è diverso da un account Stripe normale: è gestito dalla piattaforma e non richiede da te la configurazione completa di Stripe. Tu ricevi i pagamenti, la piattaforma gestisce lo split.

**Step 2 — Configura Webhook:**
Il webhook è il meccanismo con cui Stripe comunica alla piattaforma quando un pagamento va a buon fine. Il sistema genera un URL webhook univoco — tu lo copi e lo incolli nelle impostazioni del tuo account Stripe (Dashboard Stripe → Developers → Webhooks → Add Endpoint). Gli eventi da selezionare sono: `checkout.session.completed` (pagamento completato), `customer.subscription.updated` (abbonamento modificato), `invoice.payment_failed` (pagamento fallito).

**Step 3 — Inserisci API Keys:**
Dal Dashboard Stripe (Developers → API Keys), copia:
- **Publishable Key** (inizia con pk_)
- **Secret Key** (inizia con sk_)
Incollale nei campi dedicati nella piattaforma e clicca "Salva e Verifica". Il sistema testa le chiavi e conferma che tutto funziona.

**Dopo il setup:**
Una volta completato il wizard, puoi generare link di pagamento per i tuoi clienti direttamente dalla lista clienti (vedi lezione 9.3).

**Dove trovarlo:** Sidebar → IMPOSTAZIONI → Stripe Connect

## Lezione 9.3: Vendere licenze ai clienti

Vendere una licenza è un processo semplice che coinvolge 3 passaggi: creare il contatto CRM, generare il link di pagamento, e aspettare la conversione automatica.

**Passo 1 — Crea un contatto CRM:**
Vai su Sidebar → LAVORO QUOTIDIANO → Clienti → "Nuovo Cliente" → seleziona tipo "CRM" (badge ambra). Inserisci nome ed email. NON serve una password — il contatto CRM non ha accesso alla piattaforma fino a quando non paga.

Il contatto CRM:
- Appare nella lista con un badge ambra "CRM"
- Non consuma una licenza
- Non può fare login
- Può ricevere link di pagamento

**Passo 2 — Genera il link di pagamento:**
Dal menu contestuale del contatto CRM → "Genera Link Pagamento". Scegli:
- **Piano**: Silver, Gold o Custom
- **Periodo**: Mensile o Annuale
- **Prezzo**: il prezzo che vuoi applicare

Il sistema genera un link Stripe Checkout personalizzato con il nome e l'email del cliente già compilati. Copia il link e invialo al cliente via WhatsApp, email, o di persona.

**Passo 3 — Conversione automatica:**
Quando il cliente paga attraverso il link:
1. Stripe notifica la piattaforma tramite webhook
2. Il pagamento viene diviso automaticamente (50/50)
3. Il contatto CRM viene convertito in cliente attivo:
   - Riceve una password temporanea (12 caratteri)
   - Gli viene assegnato il livello scelto (Silver/Gold)
   - Gli agenti AI vengono attivati secondo il piano
   - Il Welcome Journey viene avviato
4. Al primo login, il cliente cambia la password temporanea

**Best practice:**
- Prepara il contatto CRM prima della vendita — quando il cliente è pronto, generi il link in 10 secondi
- Invia il link tramite WhatsApp per massimizzare il tasso di conversione (apertura WhatsApp >> apertura email)
- Se hai tanti clienti da convertire, usa le campagne WhatsApp per inviare i link in batch

**Dove trovarlo:** Sidebar → LAVORO QUOTIDIANO → Clienti → Contatti CRM

---

# PACCHETTO 10: TEAM & DIPENDENTI UMANI — Gestione Team

## Lezione 10.1: Creare reparti e organizzare il team

Se hai collaboratori, dipendenti o un team, la piattaforma ti permette di organizzarli in reparti con ruoli e permessi specifici.

**La struttura organizzativa:**

La piattaforma gestisce il team attraverso:
- **Reparti (Departments)**: gruppi funzionali (es. "Vendite", "Marketing", "Supporto Clienti")
- **Dipendenti umani**: le persone del tuo team, assegnate a uno o più reparti
- **Ruoli**: i permessi di accesso di ogni dipendente (cosa può vedere e fare)

**Come creare un reparto:**

1. Vai su Sidebar → LAVORO QUOTIDIANO → Clienti → Tab Dipendenti
2. Clicca "Nuovo Reparto"
3. Assegna un nome, una descrizione e un colore identificativo
4. Definisci i permessi del reparto (quali sezioni della piattaforma sono accessibili)

**Come aggiungere un dipendente:**

1. Nella Tab Dipendenti, clicca "Nuovo Dipendente"
2. Inserisci nome, email e reparto di appartenenza
3. Il sistema genera automaticamente le credenziali di accesso
4. Il dipendente riceve un'email con le istruzioni per il primo login

**Ogni dipendente ha il suo AI:**

Ogni membro del team ha accesso a un AI Assistant personale, configurato in base al suo ruolo e reparto. L'AI del venditore avrà istruzioni diverse dall'AI del supporto clienti. Questo permette a ogni persona di avere un assistente specializzato per le proprie esigenze.

**Dove trovarlo:** Sidebar → LAVORO QUOTIDIANO → Clienti → Tab Dipendenti

## Lezione 10.2: Gestire le licenze

Le licenze determinano quanti clienti e dipendenti puoi gestire sulla piattaforma. Capire come funzionano è fondamentale per pianificare la crescita.

**Come funzionano le licenze:**

- La tua Licenza Diamond include un numero massimo di licenze client (Silver + Gold)
- Ogni cliente attivo con login consuma 1 licenza
- I contatti CRM (senza login) NON consumano licenze
- I dipendenti del team consumano licenze separate

**Dove verificare le licenze:**

Nella barra in alto della piattaforma c'è un contatore che mostra: "X/Y licenze usate" dove X sono le licenze attive e Y il limite del tuo piano.

**Gestire il piano:**

Vai su Sidebar → IMPOSTAZIONI → Piano per vedere:
- Il tuo piano attuale
- Quante licenze hai usato vs disponibili
- Le funzionalità incluse nel tuo piano
- Opzioni di upgrade se hai bisogno di più licenze

**Strategia:**

Usa i contatti CRM per gestire i lead in fase di conversione senza consumare licenze. Converti in clienti attivi solo quando il lead paga e ha bisogno dell'accesso alla piattaforma. Questo ti permette di gestire un CRM illimitato di prospect senza preoccuparti dei limiti di licenza.

**Dove trovarlo:** Sidebar → IMPOSTAZIONI → Piano

## Lezione 10.3: Multi-profilo e accesso multi-consulente

Una funzionalità avanzata della piattaforma è la possibilità per un utente di essere cliente di più consulenti contemporaneamente.

**Come funziona:**

Se hai un cliente che lavora anche con un altro consulente sulla stessa piattaforma, non serve creare account separati. Lo stesso utente può:
- Fare login con le stesse credenziali
- Vedere i contenuti di entrambi i consulenti
- Avere AI Assistant separati per ogni consulente (con System Prompt e Knowledge Base diversi)
- Tracciare il progresso formativo separatamente per ogni consulente

**Quando serve:**

Questo è utile quando:
- Più consulenti collaborano sullo stesso cliente
- Un cliente segue percorsi formativi diversi con consulenti diversi
- Un'azienda ha più figure interne che lavorano con consulenti specializzati diversi

**Come configurarlo:**

Il sistema gestisce automaticamente i multi-profili. Quando un secondo consulente crea un cliente con la stessa email, il sistema riconosce che l'utente esiste già e crea un collegamento aggiuntivo senza duplicare l'account.

**Dove trovarlo:** Automatico — gestito dal sistema
