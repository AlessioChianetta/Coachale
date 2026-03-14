# Script Vocali — Setup (27 lezioni) + Accademia (30 lezioni)

> Ogni script è pensato per essere letto a voce durante una registrazione video.
> Tono: professionale ma amichevole, come un mentore che spiega a un collega.
> Tra parentesi quadre [così] trovi indicazioni di regia (es. "mostra schermo").

---

# PARTE 1 — SETUP (27 lezioni)

---

## ⚙️ Modulo: Setup Base (4 lezioni)

---

### Lezione 1 — AI Engine (Google AI Studio)
**Durata stimata: 3 minuti**

Benvenuto nella prima lezione del setup base. Qui parliamo del motore AI della piattaforma, cioè Google AI Studio con le API di Gemini.

La buona notizia è che la piattaforma ha già un motore AI condiviso pre-configurato. Questo significa che dal primo minuto in cui accedi, tutte le funzioni di intelligenza artificiale — gli agenti WhatsApp, le email automatiche, la generazione di idee, l'analisi dei contenuti — funzionano già senza che tu debba fare niente.

Però, se vuoi avere un account AI dedicato — e te lo consiglio se inizi a lavorare seriamente con la piattaforma — puoi collegare una tua API Key personale di Google AI Studio. Vediamo come fare.

[Mostra schermo — sidebar sinistra]

Dalla sidebar sinistra, vai su "Setup Wizard". Nell'elenco degli step, troverai "AI Engine (Gemini)" nella sezione "Integrazioni e Sistema". Cliccaci sopra.

[Mostra schermo — pannello configurazione inline]

Vedrai due campi. Il primo è "API Key Google AI Studio". Per ottenerla, vai su aistudio.google.com — te lo scrivo anche qui nel campo, c'è il link diretto. Una volta su Google AI Studio, clicca su "Get API Key" oppure "API Keys" nel menu. Google ti genera una chiave che inizia con "AIza" seguita da una lunga stringa di caratteri. Copiala e incollala qui nel campo.

Il secondo campo è "Project ID" ed è opzionale. Se usi Google AI Studio — che è quello che ti consiglio — puoi lasciarlo vuoto. Serve solo se hai un progetto Google Cloud separato.

Clicca "Salva" e poi "Testa" per verificare che la connessione funzioni. Se vedi il segno di spunta verde, sei a posto.

Ricorda: questo step è marcato come opzionale e il sistema lo segna come completato anche se non inserisci nulla, perché il provider condiviso è già attivo. Ma avere una chiave personale ti dà più controllo e nessun limite di rate condiviso con altri utenti.

---

### Lezione 2 — Twilio + WhatsApp Business
**Durata stimata: 5 minuti**

Questa è una delle configurazioni più importanti di tutta la piattaforma, perché WhatsApp è il canale principale attraverso cui i tuoi agenti AI comunicano con lead e clienti.

Per far funzionare WhatsApp nella piattaforma, usiamo Twilio come provider. Twilio è il servizio che fa da ponte tra il tuo numero WhatsApp Business e la nostra piattaforma. Vediamo come configurarlo passo passo.

[Mostra schermo — Setup Wizard → Configurazione Twilio + WhatsApp]

Nello Setup Wizard, clicca sullo step "Configurazione Twilio + WhatsApp". Si apre il pannello di configurazione con tre campi.

Il primo campo è "Account SID". Questo lo trovi sulla dashboard di Twilio. Vai su console.twilio.com, fai login, e appena entri nella dashboard vedrai "Account SID" scritto in chiaro. È una stringa che inizia con "AC" seguita da trentadue caratteri. Copiala e incollala qui.

Il secondo campo è "Auth Token". Sempre dalla dashboard di Twilio, subito sotto l'Account SID, trovi l'Auth Token. Attenzione: per motivi di sicurezza, questo campo una volta salvato non verrà più mostrato. Quindi assicurati di copiarlo correttamente.

Il terzo campo è il "Numero WhatsApp". Qui devi inserire il tuo numero WhatsApp Business nel formato specifico di Twilio, che è: "whatsapp:" seguito dal segno più, il prefisso paese e il numero. Per l'Italia, sarà qualcosa come whatsapp:+39 seguito dal tuo numero. Questo formato è importante — se lo scrivi senza il prefisso "whatsapp:" non funzionerà.

[Mostra schermo — bottone Salva e Testa]

Una volta compilati tutti e tre i campi, clicca "Salva". Poi clicca il bottone "Testa connessione". Il sistema verificherà che le credenziali siano corrette e che il numero WhatsApp sia effettivamente collegato al tuo account Twilio.

Se il test passa, vedrai la spunta verde. Se fallisce, i motivi più comuni sono: Account SID copiato con spazi in più, Auth Token scaduto o rigenerato su Twilio senza aggiornarlo qui, oppure il numero WhatsApp non ancora approvato da Meta sul tuo account Twilio.

Un consiglio importante: questo step è la base per moltissime altre funzionalità — agenti inbound, outbound, campagne, template. Senza Twilio configurato correttamente, niente di tutto ciò funzionerà. Quindi prenditi il tempo per farlo bene.

---

### Lezione 3 — Email SMTP
**Durata stimata: 4 minuti**

Configurare il server SMTP è fondamentale perché la piattaforma usa le email per tantissime cose: le email riassuntive dopo le consulenze, il nurturing automatico a 365 giorni, le notifiche, e le comunicazioni personalizzate dall'AI.

[Mostra schermo — Setup Wizard → Email SMTP]

Nello Setup Wizard, vai allo step "Email SMTP" nella sezione "Integrazioni e Sistema". Si apre un pannello con sette campi. Li vediamo uno per uno.

"Server SMTP" — qui inserisci l'indirizzo del tuo server di posta. Se usi Gmail, scrivi smtp.gmail.com. Se usi Outlook, è smtp.office365.com. Se hai un provider diverso, controlla la documentazione del tuo servizio email.

"Porta" — la porta standard per l'invio con crittografia TLS è 587. Se il tuo provider usa SSL, la porta è 465. Nel dubbio, usa 587.

"Usa SSL/TLS" — questo toggle va attivato. La crittografia è necessaria per la sicurezza delle comunicazioni.

"Email / Username" — inserisci il tuo indirizzo email completo, quello che usi per accedere al servizio. Ad esempio, tuonome@gmail.com.

"Password / App Password" — e qui attenzione, perché se usi Gmail con l'autenticazione a due fattori — e dovresti averla attiva — non puoi usare la tua password normale. Devi generare una "App Password" dedicata. Per farlo, vai su account.google.com, poi nella sezione Sicurezza, cerca "Password per le app" o "App Passwords". Crea una nuova password per la piattaforma e usa quella qui. Sono sedici caratteri senza spazi.

"Email mittente" — l'indirizzo che apparirà come mittente nelle email inviate. Può essere lo stesso del tuo account o un alias tipo noreply@tuodominio.com.

"Nome mittente" — il nome che i destinatari vedranno. Può essere il tuo nome, il nome della tua azienda, o una combinazione. Ad esempio "Marco Rossi - Studio Consulenza".

Dopo aver compilato tutto, clicca "Salva" e poi "Testa connessione". Il sistema invierà un'email di test per verificare che tutto funzioni.

---

### Lezione 4 — Google Calendar
**Durata stimata: 3 minuti**

Collegare Google Calendar alla piattaforma è essenziale per due motivi: primo, sincronizza automaticamente i tuoi appuntamenti esistenti con il sistema di booking; secondo, permette agli agenti AI di prenotare consulenze direttamente nel tuo calendario quando parlano con i clienti.

[Mostra schermo — Setup Wizard → Google Calendar Consulente]

Nello Setup Wizard, vai allo step "Google Calendar Consulente". A differenza degli altri step dove compili dei campi, qui troverai un bottone "Connetti Google Calendar" che ti porta direttamente alla procedura di autorizzazione OAuth di Google.

[Mostra schermo — finestra OAuth Google]

Quando clicchi, si apre una finestra di Google che ti chiede di selezionare il tuo account Google e autorizzare la piattaforma ad accedere al tuo calendario. Seleziona l'account Google che usi per gli appuntamenti di lavoro, clicca "Consenti" su tutti i permessi richiesti — la piattaforma ha bisogno di leggere e scrivere eventi nel calendario.

Una volta autorizzato, verrai reindirizzato automaticamente alla piattaforma e vedrai il pallino verde con scritto "Connesso".

Da questo momento in poi, il sistema sincronizza il calendario ogni cinque minuti. Gli appuntamenti che crei su Google Calendar appariranno nella sezione Appuntamenti della piattaforma, e viceversa — quando un agente AI prenota un appuntamento con un cliente, apparirà anche nel tuo Google Calendar.

Un dettaglio importante: la sincronizzazione copre i prossimi novanta giorni. Se cancelli un appuntamento su Google Calendar, il sistema lo rileva automaticamente e lo marca come cancellato anche nella piattaforma. Lo stesso vale per le modifiche di orario.

---

## 🎯 Modulo: Acquisisci Lead (6 lezioni)

---

### Lezione 5 — Import Lead da API Esterne
**Durata stimata: 3 minuti**

Questa funzione ti permette di importare automaticamente i lead da fonti esterne — CRM, landing page, moduli di contatto — direttamente nel tuo database sulla piattaforma.

[Mostra schermo — Setup Wizard → Import Lead]

Nello Setup Wizard, clicca sullo step "Import Lead". Il sistema ti porta nella sezione Configurazione, tab "Import Lead".

Qui puoi configurare le API di importazione. Il concetto è semplice: la piattaforma espone un endpoint — cioè un indirizzo web — a cui i tuoi strumenti esterni possono inviare i dati dei lead. Ogni volta che un nuovo lead compila un form sul tuo sito, o si iscrive tramite una landing page, il sistema esterno lo invia a questo endpoint e il lead appare automaticamente nella tua piattaforma.

Per configurarlo, hai bisogno di copiare l'URL dell'endpoint e la chiave API che trovi in questa pagina. Poi vai nel tuo strumento esterno — che sia un CRM, un form builder come Typeform, o un tool di advertising — e configuri un webhook o un'integrazione che invii i dati a questo indirizzo.

I campi che il sistema si aspetta sono: nome, email, telefono, e opzionalmente la fonte del lead. Se il tuo strumento esterno invia campi con nomi diversi, puoi configurare la mappatura qui nella sezione "Mappatura campi".

Una volta configurato, clicca "Testa" per inviare un lead di prova e verificare che arrivi correttamente nel sistema.

---

### Lezione 6 — Agente Inbound
**Durata stimata: 6 minuti**

L'agente inbound è il cuore del tuo sistema di acquisizione clienti. È un agente AI che risponde automaticamente a chiunque ti scriva su WhatsApp, qualificando i lead e prenotando appuntamenti — ventiquattro ore su ventiquattro, sette giorni su sette.

[Mostra schermo — sidebar → Agenti WhatsApp]

Per crearlo, vai nella sezione "Agenti WhatsApp" dalla sidebar. Clicca il bottone "Nuovo Agente" in alto a destra.

Si apre un wizard a cinque step. Vediamoli tutti.

[Mostra schermo — Step 1: Configurazione Base]

Step uno: Configurazione Base. Qui dai un nome al tuo agente — ad esempio "Assistente Marco" o "Receptionist Studio Rossi". Poi selezioni il tipo: per un agente inbound, scegli "Receptionist (Inbound)". Questo dice al sistema che l'agente deve rispondere ai messaggi in arrivo, non iniziare conversazioni.

Poi scegli la modalità di integrazione. "WhatsApp + Agente AI" è quella completa, che usa Twilio per ricevere e inviare messaggi reali. "Solo Agente AI" è per test interni, senza collegamento a WhatsApp.

Se hai già configurato Twilio nello step precedente, le credenziali verranno proposte automaticamente. Altrimenti, puoi inserirle qui.

[Mostra schermo — Step 2: Disponibilità]

Step due: Disponibilità e Automazioni. Qui configuri gli orari di lavoro dell'agente — ad esempio dalle 8 alle 20, dal lunedì al venerdì. Puoi anche scrivere un messaggio personalizzato per chi scrive fuori orario, tipo "Grazie per il messaggio, ti risponderemo domani mattina alle 8".

In questo step trovi anche le funzionalità avanzate. La "Prenotazione Appuntamenti" permette all'agente di controllare il tuo calendario e proporre slot liberi. La "Gestione Obiezioni" usa tecniche di vendita per gestire i "no". La "Disqualificazione Lead" filtra automaticamente chi non è in target.

[Mostra schermo — Step 3: Brand Voice]

Step tre: Brand Voice. Questa è la sezione dove dai all'agente la conoscenza del tuo business. Compili il nome della tua attività, la tua bio professionale, la descrizione del business. Poi c'è la sezione "Autorità e Credibilità" dove inserisci la tua visione, missione, USP — cioè cosa ti rende unico — i tuoi valori, gli anni di esperienza e i risultati ottenuti.

C'è anche l'integrazione con la Base di Conoscenza: puoi caricare PDF, documenti o testo libero per dare all'agente informazioni specifiche sul tuo settore. Più materiale gli dai, più le sue risposte saranno precise e pertinenti.

[Mostra schermo — Step 4: Sistema Livelli]

Step quattro: Sistema Livelli di Accesso. La piattaforma supporta tre livelli: Bronze, Silver e Gold. Per un agente inbound, tipicamente attivi il livello Bronze per i lead che arrivano dal link pubblico. Qui puoi personalizzare le istruzioni specifiche per ogni livello. Ad esempio, per il Bronze potresti limitare le risposte a informazioni generali, mentre per il Gold offri un trattamento VIP con risposte più dettagliate.

[Mostra schermo — Step 5: Istruzioni AI]

Step cinque: Istruzioni AI. Qui scegli l'identità dell'agente — può presentarsi come "assistente di" seguito dal tuo nome, oppure come un professionista diretto. Poi selezioni la personalità: "Amico Fidato" per un tono caldo e accogliente, "Stratega Diretto" per un approccio più business, "Coach Motivazionale" per un tono energico.

Infine, c'è il pannello delle istruzioni dove puoi personalizzare completamente il prompt dell'AI. Ci sono template predefiniti per diversi ruoli — Receptionist, Setter, Customer Success — oppure puoi scrivere le tue istruzioni personalizzate.

Una volta completati tutti e cinque gli step, clicca "Crea Agente". Il sistema lo attiverà e inizierà a rispondere ai messaggi in arrivo.

---

### Lezione 7 — Template WhatsApp Approvato
**Durata stimata: 4 minuti**

I template WhatsApp sono i messaggi pre-approvati che puoi inviare proattivamente ai contatti. A differenza dei messaggi normali — che puoi mandare solo in risposta entro ventiquattro ore — i template ti permettono di scrivere per primo a un lead in qualsiasi momento. Però Meta li deve approvare prima.

[Mostra schermo — sidebar → Template WhatsApp]

Dalla sidebar, vai su "Template WhatsApp". Qui vedi la lista dei tuoi template, organizzati per stato: Approvati, In attesa, Rifiutati, e Bozze.

Per creare un nuovo template, clicca "Nuovo Template" in alto a destra.

[Mostra schermo — wizard creazione template, Step 1]

Si apre un wizard a tre step. Nel primo step, scegli lo scenario del template. Hai diverse opzioni predefinite: "Primo Contatto a Freddo" per raggiungere lead nuovi, "Follow-up" per chi non ha risposto, "Riattivazione" per contatti dormienti, oppure puoi scegliere "Personalizzato" per scrivere da zero.

[Mostra schermo — Step 2: composizione messaggio]

Nel secondo step, componi il messaggio. L'editor ti permette di usare variabili dinamiche — le scrivi tra parentesi graffe. Ad esempio, scrivi parentesi graffa aperta, nome_lead, parentesi graffa chiusa e quando il messaggio verrà inviato, il sistema sostituirà automaticamente con il nome reale del destinatario. Le variabili disponibili includono il nome del lead, il nome del consulente, il nome dell'azienda e altre informazioni dal CRM.

In basso c'è la tabella di mappatura variabili che ti mostra come ogni variabile viene convertita nel formato richiesto da Twilio.

[Mostra schermo — Step 3: conferma]

Nel terzo step, rivedi il template finale e clicchi "Salva". Il template viene salvato come bozza.

Per inviarlo all'approvazione di Meta tramite Twilio, torna nella lista template, trova il tuo template e clicca l'icona di esportazione. Il sistema converte automaticamente il formato, lo invia a Twilio, e Twilio lo sottopone a Meta per l'approvazione. L'approvazione può richiedere da pochi minuti a quarantotto ore.

Puoi controllare lo stato dell'approvazione in qualsiasi momento dalla lista — il badge a fianco del nome ti dice se è "Approvato", "In attesa" o "Rifiutato".

---

### Lezione 8 — Link Pubblico Agente
**Durata stimata: 3 minuti**

Il link pubblico è l'indirizzo web che puoi condividere con chiunque per permettergli di chattare direttamente con il tuo agente AI. È perfetto per i social, le bio di Instagram, i biglietti da visita, le landing page.

[Mostra schermo — sidebar → Chat Pubblica Agenti]

Dalla sidebar, vai su "Chat Pubblica Agenti". Qui vedi la lista di tutti i link pubblici che hai creato.

Per generare un nuovo link, devi prima avere almeno un agente creato. Se l'hai già fatto nella lezione precedente, sei a posto. Clicca "Genera Link" e seleziona l'agente a cui associarlo.

[Mostra schermo — configurazione link]

Il sistema genera automaticamente uno slug — cioè la parte finale dell'URL — basato sul nome dell'agente con una stringa casuale per renderlo unico. Se preferisci uno slug personalizzato, puoi modificarlo: ad esempio potresti usare "consulenza-marco" o "assistente-studio-rossi". Lo slug deve contenere solo lettere minuscole, numeri e trattini.

Puoi anche configurare il tipo di accesso: "Pubblico" significa che chiunque con il link può chattare; "Con password" richiede una password che definisci tu; "Con token" è per integrazioni più avanzate.

Per ogni link puoi impostare un limite giornaliero di messaggi per evitare abusi. Ad esempio, puoi limitare a venti messaggi al giorno per utente non registrato.

Una volta creato il link, lo puoi copiare e condividere ovunque. Dalla pagina di monitoraggio puoi vedere in tempo reale quante persone hanno usato il link, quanti messaggi sono stati scambiati, e puoi leggere le conversazioni tra i visitatori e l'agente.

---

### Lezione 9 — Instagram Direct Messaging
**Durata stimata: 3 minuti**

Se hai un profilo Instagram Business, puoi collegarlo alla piattaforma per gestire i messaggi diretti con l'intelligenza artificiale. I tuoi agenti AI risponderanno automaticamente ai DM di Instagram esattamente come fanno su WhatsApp.

[Mostra schermo — Setup Wizard → Instagram DM]

Nello Setup Wizard, clicca sullo step "Instagram Direct Messaging". Vedrai un bottone "Vai alla configurazione Instagram" che ti porta nella pagina Configurazione, tab Instagram.

Il collegamento avviene tramite OAuth — la procedura standard di autorizzazione di Meta. Clicca il bottone, si apre una finestra dove devi selezionare il tuo account Facebook collegato alla pagina Instagram Business, dare i permessi necessari, e confermare.

Un requisito fondamentale: il tuo profilo Instagram deve essere un account Business o Creator — non un account personale. Se hai un account personale, puoi convertirlo gratuitamente dalle impostazioni di Instagram.

Una volta collegato, il sistema sincronizza automaticamente i messaggi in arrivo. Nella sezione Agenti WhatsApp, potrai assegnare un agente anche al canale Instagram, e da quel momento l'agente risponderà sia ai messaggi WhatsApp che ai DM di Instagram con la stessa intelligenza e personalità.

---

### Lezione 10 — WhatsApp AI Personale
**Durata stimata: 2 minuti**

Questa lezione riguarda una configurazione aggiuntiva per chi vuole avere un motore AI dedicato specificamente per i propri agenti WhatsApp.

[Mostra schermo — Configurazione → tab AI]

Dalla pagina Configurazione, vai al tab "AI". Qui puoi inserire la tua API Key personale di Google AI Studio, quella che abbiamo visto nella primissima lezione.

La differenza rispetto alla configurazione generale è che questa chiave viene usata specificamente per le risposte degli agenti WhatsApp. Se hai un volume alto di conversazioni, avere una chiave dedicata ti garantisce che le risposte degli agenti non vengano rallentate da altre funzioni della piattaforma che usano l'AI.

Per completare questa lezione, se hai già configurato la tua API Key nel setup base, sei già a posto. In caso contrario, puoi semplicemente segnare questa lezione come completata cliccando il bottone "Segna come completata" qui in basso, perché il provider condiviso funziona comunque.

---

## 💰 Modulo: Vendi & Converti (5 lezioni)

---

### Lezione 11 — Stripe — Pagamenti
**Durata stimata: 4 minuti**

Stripe è il sistema che ti permette di ricevere pagamenti dai tuoi clienti direttamente dalla piattaforma. Tutto è automatizzato: dal momento in cui un cliente paga, il sistema gli crea l'account, gli assegna il livello di accesso e lo attiva automaticamente.

[Mostra schermo — Setup Wizard → Stripe Connect]

Nello Setup Wizard, clicca su "Stripe Connect". Il sistema usa Stripe Connect Express, che significa che Stripe gestisce tutta la parte di conformità bancaria per te.

La configurazione è un mini-wizard a tre step.

Step uno: Collega Stripe. Clicca il bottone "Connetti Stripe" e verrai portato sulla pagina di onboarding di Stripe, dove inserisci i tuoi dati bancari, il codice fiscale o la partita IVA, e le informazioni sulla tua attività. Stripe verificherà la tua identità e attiverà l'account — di solito in pochi minuti.

Step due: Configura Webhook. Questo è un passaggio tecnico ma importante. Il webhook è il meccanismo con cui Stripe avvisa la piattaforma quando un pagamento va a buon fine. Nella pagina vedrai un URL da copiare — è l'indirizzo del webhook. Devi andare nella dashboard di Stripe, sezione Developers, poi Webhooks, cliccare "Aggiungi endpoint", incollare l'URL, e selezionare l'evento "checkout.session.completed". Stripe ti darà un "Webhook Secret" che inizia con "whsec_" — copialo e incollalo qui nella piattaforma.

Step tre: Chiavi API. Questo è opzionale ma utile per le automazioni avanzate. Se vuoi che il sistema crei automaticamente le sessioni di checkout quando invii un link di pagamento a un cliente, devi inserire la tua Secret Key di Stripe. La trovi nella dashboard Stripe sotto Developers, API Keys.

Una volta completati i tre step, il sistema è pronto per gestire i pagamenti. Il revenue share è configurato automaticamente — la piattaforma gestisce la suddivisione degli incassi in modo trasparente.

---

### Lezione 12 — Agente Outbound
**Durata stimata: 4 minuti**

L'agente outbound è il contrario dell'inbound: invece di aspettare che i lead ti scrivano, è lui che li contatta per primo. È il tuo "setter" automatico che avvia conversazioni con i lead usando i template WhatsApp approvati.

[Mostra schermo — sidebar → Agenti WhatsApp → Nuovo Agente]

Per crearlo, vai su Agenti WhatsApp e clicca "Nuovo Agente". Nel primo step, come tipo di agente seleziona "Proactive Setter (Outbound)".

La differenza principale rispetto all'agente inbound è che l'outbound ha bisogno di template WhatsApp approvati per iniziare le conversazioni. Non può mandare un messaggio libero a freddo — Meta non lo permette. Deve usare un template pre-approvato.

Gli step del wizard sono gli stessi che abbiamo visto per l'inbound — configurazione base, disponibilità, brand voice, livelli e istruzioni — ma le istruzioni AI sono diverse. Per un outbound, il focus è sulla qualificazione: l'agente deve presentare i tuoi servizi, capire il bisogno del lead, gestire le obiezioni e prenotare un appuntamento.

Un consiglio pratico: nell'area Brand Voice, aggiungi il massimo di informazioni possibile sui tuoi servizi, i prezzi, i risultati ottenuti con altri clienti. Più il tuo agente sa, più è convincente nelle conversazioni.

Una volta creato, l'agente outbound verrà usato dalle Campagne Marketing — che vediamo tra poco — per contattare automaticamente i lead nella tua lista.

---

### Lezione 13 — Agente Consulenziale
**Durata stimata: 3 minuti**

L'agente consulenziale è il terzo tipo di agente AI. A differenza dell'inbound che qualifica e dell'outbound che vende, il consulenziale offre supporto avanzato. È pensato per i clienti già acquisiti — quelli di livello Silver e Gold — che hanno domande complesse e hanno bisogno di risposte approfondite.

[Mostra schermo — sidebar → Agenti WhatsApp → Nuovo Agente]

Per crearlo, vai su Agenti WhatsApp, clicca "Nuovo Agente" e come tipo seleziona il ruolo consulenziale.

La chiave dell'agente consulenziale è la Base di Conoscenza. Nello step Brand Voice, carica tutti i documenti rilevanti: manuali, guide, procedure, FAQ, materiale dei tuoi corsi. L'agente usa un sistema chiamato RAG — Retrieval-Augmented Generation — che gli permette di cercare informazioni specifiche nei tuoi documenti e usarle per rispondere con precisione.

Un esempio pratico: se un cliente Gold ti scrive su WhatsApp chiedendo "Come applico la tecnica X che hai spiegato nel corso del secondo trimestre?", l'agente cerca nei documenti del corso, trova la sezione rilevante, e risponde con una spiegazione personalizzata basata su quello che hai insegnato.

Nelle istruzioni AI, imposta il tono come "Coach Motivazionale" o "Stratega Diretto" — un tono che comunichi autorevolezza e competenza. Ricordati anche di configurare i livelli: questo agente tipicamente è riservato ai clienti Silver e Gold, non ai Bronze.

---

### Lezione 14 — Prima Campagna Marketing
**Durata stimata: 5 minuti**

Le campagne marketing sono il motore della tua acquisizione clienti su scala. Permettono di contattare automaticamente centinaia di lead usando i tuoi agenti outbound e i template WhatsApp approvati.

[Mostra schermo — sidebar → Campagne]

Dalla sidebar, vai su "Campagne". In alto vedrai i KPI globali: campagne totali, lead totali, lead convertiti, e tasso di conversione.

Se è la tua prima volta, vedrai anche una checklist guidata in tre step: primo, configura un agente outbound; secondo, crea almeno un template approvato; terzo, crea la campagna. I primi due li abbiamo già fatti.

[Mostra schermo — bottone "Nuova Campagna"]

Clicca "Nuova Campagna". Si apre un wizard.

Step uno: dai un nome alla campagna e seleziona il tipo. I tipi disponibili sono "Outbound Ads" per lead da pubblicità, "Inbound Form" per lead da moduli, "Referral" per passaparola, e altri. Poi imposti la "Temperatura Lead": freddo, tiepido o caldo — questo dice all'agente AI come approcciarsi.

Step due: selezioni l'agente outbound che gestirà le conversazioni e il template WhatsApp che userà come messaggio di apertura.

Step tre: personalizzazione AI. Qui è dove la magia succede. Definisci il "Hook" — il gancio che cattura l'attenzione nel primo messaggio. Poi lo "Stato Ideale" — cosa vuole ottenere il tuo lead. I "Desideri Impliciti" — i bisogni nascosti. E gli "Obiettivi di Default" — cosa vuoi che l'agente faccia durante la conversazione.

L'ultimo pezzo è la fonte dei lead. Puoi definire una stringa di fonte — ad esempio "facebook_ads_marzo" — e tutti i lead che arrivano con quella fonte vengono automaticamente assegnati a questa campagna. Il sistema genera anche un "UTM Link" — un link tracciato che puoi usare nelle tue inserzioni.

Una volta creata la campagna, l'agente inizierà a contattare automaticamente i lead che entrano con la fonte specificata. Nella dashboard della campagna puoi monitorare tutto in tempo reale: lead contattati, che hanno risposto, convertiti, e un grafico delle performance giorno per giorno.

---

### Lezione 15 — Email Riassuntiva Post-Consulenza
**Durata stimata: 3 minuti**

Questa funzione si chiama "Echo" ed è una delle più apprezzate dai consulenti. Dopo una consulenza con un cliente, l'AI genera automaticamente un'email riassuntiva professionale con i punti chiave discussi, le azioni da intraprendere e le scadenze.

[Mostra schermo — sidebar → Appuntamenti]

Dalla sidebar, vai su "Appuntamenti". Qui vedi il tuo calendario con tutti gli appuntamenti — sia quelli creati sulla piattaforma che quelli sincronizzati da Google Calendar.

Quando un appuntamento viene completato e ha una trascrizione — ad esempio da uno strumento come Fathom che registra le videochiamate — il sistema attiva automaticamente Echo.

[Mostra schermo — dettaglio appuntamento completato]

Clicca su un appuntamento completato. Nel pannello di dettaglio, vedrai la sezione "Email Riassuntiva". L'AI analizza la trascrizione della consulenza e genera una bozza che include: un riassunto strutturato della conversazione, i task da completare con date e priorità, e eventuali esercizi pratici da assegnare al cliente.

La bozza non viene inviata subito — resta in attesa della tua revisione. Hai tre opzioni: "Approva e Invia" per mandarla direttamente al cliente; "Salva per AI" per salvare il contenuto nel contesto AI del cliente senza inviare email; oppure "Scarta" per eliminare la bozza e rigenerarla.

Per completare questo step nello Setup Wizard, devi inviare almeno una email riassuntiva. Puoi farlo anche con un appuntamento di test — crea un appuntamento, segnalo come completato, scrivi qualche nota, e lascia che Echo generi il riassunto.

---

## 🤖 Modulo: Automazioni AI (6 lezioni)

---

### Lezione 16 — AI Autonomo
**Durata stimata: 5 minuti**

L'AI Autonomo è il sistema che fa lavorare la piattaforma per te anche quando non ci sei. È un team di nove dipendenti AI — ognuno con un nome, un ruolo e una specializzazione — che analizzano i tuoi dati e completano task automaticamente.

[Mostra schermo — sidebar → AI Autonomo]

Dalla sidebar, vai su "AI Autonomo". La pagina ha quattro tab principali: Dashboard, Attività, Dipendenti, e Impostazioni.

[Mostra schermo — tab Dipendenti]

Iniziamo dal tab "Dipendenti" per capire chi sono. Alessia è la consulente vocale — gestisce le chiamate e i follow-up. Millie è la scrittrice di email — gestisce la posta in arrivo. Echo crea i riassunti delle consulenze. Nova gestisce i social media. Stella monitora le conversazioni WhatsApp. Marco è il coach che ti dà consigli strategici. Robert è il coach vendite. Hunter cerca lead nuovi. Leonardo progetta i funnel di conversione.

[Mostra schermo — tab Impostazioni]

Nel tab "Impostazioni", trovi il toggle principale per attivare l'autonomia. Quando lo accendi, i dipendenti AI iniziano a lavorare. Puoi anche configurare gli orari: ad esempio, le otto di mattina fino alle otto di sera, dal lunedì al venerdì. I dipendenti non lavoreranno fuori da questi orari.

Ogni singolo dipendente può essere messo in pausa individualmente. Se ad esempio vuoi che solo Millie e Stella lavorino ma non gli altri, puoi configurarlo.

[Mostra schermo — tab Dashboard]

La Dashboard è una board Kanban con quattro colonne: "Da Approvare", "Programmati", "In Corso" e "Completati". Quando un dipendente AI propone un'azione — ad esempio Millie vuole rispondere a un'email — la trovi nella colonna "Da Approvare". Puoi leggerla, approvarla, modificarla, o rifiutarla.

Per completare questo step, attiva l'autonomia e aspetta che almeno un task venga generato e completato. Di solito bastano poche ore perché il sistema inizi a proporre azioni basate sui tuoi dati.

---

### Lezione 17 — Email Journey
**Durata stimata: 4 minuti**

L'Email Journey è il sistema di automazione email post-consulenza. Dopo ogni consulenza, il sistema invia al cliente una sequenza di email personalizzate — una al giorno per un mese — basate sulla conversazione avuta e sugli obiettivi concordati.

[Mostra schermo — sidebar → Configurazione AI → tab AI Email]

Dalla sidebar, vai su "Configurazione AI", poi seleziona il tab "AI Email" oppure il tab "Echo" e poi "Percorso".

Qui configuri come il sistema gestisce le email automatiche. La configurazione principale è scegliere tra due modalità: "Bozza" e "Invio Automatico".

In modalità "Bozza", l'AI genera le email ma non le invia — le mette in una coda che puoi revisionare. È perfetto per chi vuole controllare tutto prima dell'invio. Troverai le bozze nel tab "Bozze Email" della stessa pagina.

In modalità "Invio Automatico", le email vengono inviate senza la tua revisione. Questo è consigliato solo dopo che hai verificato la qualità delle prime bozze e ti fidi del tono e del contenuto che l'AI produce.

[Mostra schermo — sezione configurazione]

Puoi personalizzare il tono delle email — professionale, amichevole, o motivazionale. Puoi anche incollare un'email di esempio nel campo "Email di Riferimento" per aiutare l'AI a replicare il tuo stile di scrittura.

Le email vengono inviate in una finestra oraria che configuri tu — ad esempio tra le tredici e le quattordici. Ogni email include azioni suggerite per il cliente, che vengono tracciate automaticamente dal sistema.

---

### Lezione 18 — Email Nurturing 365
**Durata stimata: 4 minuti**

Il Nurturing 365 è diverso dall'Email Journey. Mentre il Journey è post-consulenza e dura un mese, il Nurturing è per i lead — persone che non sono ancora diventate clienti — e dura un anno intero. Trecentosessantacinque email, una al giorno, per mantenere la relazione viva e portare gradualmente il lead verso la decisione di acquisto.

[Mostra schermo — sidebar → Configurazione AI → tab Lead Nurturing]

Dalla sidebar, vai su "Configurazione AI", poi seleziona il tab "Lead Nurturing" oppure dalla Dashboard clicca su "Lead 365".

La pagina ha diversi sotto-tab. Iniziamo dalla "Configurazione".

[Mostra schermo — configurazione nurturing]

Il toggle principale è "Nurturing Automatico". Quando lo attivi, il sistema inizia a inviare email automatiche ai tuoi lead. Puoi configurare l'ora di invio — ad esempio le nove di mattina — e i minuti.

Il sistema classifica i lead per temperatura: "Caldo" con più di dieci punti di engagement, "Tiepido" tra tre e nove, e "Freddo" sotto i tre. I punti vengono calcolati automaticamente in base a aperture e click delle email.

[Mostra schermo — tab Argomenti]

Nel tab "Argomenti" trovi l'indice dei trecentosessantacinque argomenti. Se è la prima volta, clicca "Genera Argomenti" e l'AI creerà automaticamente un piano editoriale annuale basato sul tuo settore, il tuo target e i tuoi servizi. Puoi modificare singoli argomenti se vuoi personalizzare la sequenza.

C'è anche una sezione "Knowledge Base" specifica per il nurturing dove puoi caricare documenti che l'AI userà come fonte per il contenuto delle email. E la sezione "Brand Voice" per definire il tono delle comunicazioni.

---

### Lezione 19 — Email Hub
**Durata stimata: 5 minuti**

L'Email Hub è la tua casella di posta intelligente dentro la piattaforma. Non è un semplice client email — è un sistema completo con classificazione AI, risposte suggerite, e gestione automatica dei ticket.

[Mostra schermo — sidebar → Email Hub]

Dalla sidebar, vai su "Email Hub". La pagina è divisa in tre aree.

A sinistra hai la sidebar con le cartelle: Inbox, Bozze, Inviati, Cestino, e le cartelle speciali come "Bozze Millie" dove trovi le risposte generate dall'AI, "Ticket Attivi" per le richieste complesse, e "Pipeline Outreach" per le sequenze di contatto automatico.

Al centro c'è la lista delle email — puoi cercarle, filtrarle per stato, e ordinare. Ogni email ha dei badge colorati: "Millie" in viola significa che l'AI ha già preparato una bozza di risposta, "Urgente" in rosso per le email ad alta priorità, "Risposto" in verde per quelle già gestite.

A destra c'è il pannello di anteprima con il contenuto dell'email e, se Millie ha lavorato, la bozza di risposta AI.

[Mostra schermo — collegamento account email]

Per iniziare, devi collegare almeno un account email. Clicca "Aggiungi Account" e compila i dati IMAP e SMTP del tuo provider. Per Gmail: server IMAP è imap.gmail.com porta 993, server SMTP è smtp.gmail.com porta 587. Usa una App Password come abbiamo visto nella lezione SMTP.

Una volta collegato, le email iniziano a sincronizzarsi. Millie — la dipendente AI delle email — analizza ogni messaggio in arrivo, lo classifica per tipo e urgenza, e se ha abbastanza contesto nel tuo brand voice e nella knowledge base, genera una bozza di risposta con un punteggio di confidenza.

Le bozze ad alta confidenza possono essere configurate per l'invio automatico. Le altre restano in attesa della tua revisione. Per ogni bozza, hai tre bottoni: "Approva e Invia", "Modifica" per ritoccarla prima dell'invio, o "Rifiuta" per scartarla.

---

### Lezione 20 — Chiamate Voice (Alessia AI)
**Durata stimata: 4 minuti**

Alessia AI è il sistema di chiamate vocali della piattaforma. Può effettuare chiamate outbound ai tuoi lead, gestire un centralino intelligente per le chiamate in entrata, e prenotare appuntamenti direttamente durante la telefonata.

[Mostra schermo — sidebar → Chiamate Voice]

Dalla sidebar, vai su "Chiamate Voice". La pagina principale ha diverse sezioni.

In alto trovi il "Pannello Coda Chiamate" — un cruscotto in tempo reale che mostra le chiamate attive con il contatore della durata, le chiamate programmate con il countdown, la coda dei tentativi per le chiamate non risposte, e la coda di approvazione per le chiamate proposte dal dipendente AI Hunter.

Sotto c'è la sezione statistiche con il totale chiamate, il costo stimato, la durata media, e lo stato di salute dei sistemi tecnici.

Per avviare una chiamata manuale, usa l'interfaccia "Nuova Chiamata" — inserisci il numero di telefono e seleziona la modalità AI: assistente, vendita, o supporto. Alessia chiamerà il numero e condurrà la conversazione in autonomia.

Le conversazioni completate appaiono nella sezione "Conversazioni" — una vista simile a WhatsApp dove puoi leggere la trascrizione completa della chiamata, con i messaggi di Alessia e le risposte del cliente separati chiaramente.

Per completare questo step, devi effettuare almeno una chiamata vocale con esito positivo. Puoi anche fare un test chiamando il tuo stesso numero.

---

### Lezione 21 — Calendario Agenti AI
**Durata stimata: 3 minuti**

Questa lezione riguarda il collegamento del tuo Google Calendar a ciascun agente WhatsApp. Quando un agente ha il calendario connesso, può verificare la tua disponibilità in tempo reale e proporre slot liberi ai lead durante la conversazione.

[Mostra schermo — sidebar → Agenti WhatsApp]

Dalla sidebar, vai su "Agenti WhatsApp". Apri un agente esistente cliccando sul suo nome.

Nella configurazione dell'agente, nello step "Disponibilità e Automazioni", trovi il blocco "Prenotazione Appuntamenti". Quando lo attivi, l'agente avrà accesso al tuo calendario per verificare gli slot liberi e proporre orari.

Ma attenzione: perché funzioni, devi anche aver collegato Google Calendar come consulente — cosa che abbiamo fatto nella lezione 4. Il calendario dell'agente usa lo stesso collegamento OAuth ma va attivato per ogni singolo agente.

Nella pagina degli agenti, vedrai un indicatore che mostra quanti agenti su quanti totali hanno il calendario connesso — ad esempio "2/3 agenti connessi". L'obiettivo è arrivare a tutti connessi.

Il risultato pratico è potente: un lead scrive al tuo agente WhatsApp chiedendo un appuntamento, l'agente controlla il tuo calendario in tempo reale, propone tre slot disponibili, il lead sceglie, e l'appuntamento viene creato automaticamente sia sulla piattaforma che su Google Calendar.

---

## 📚 Modulo: Contenuti & Corsi (5 lezioni)

---

### Lezione 22 — Base di Conoscenza
**Durata stimata: 4 minuti**

La Base di Conoscenza è il "cervello" che alimenta l'intelligenza di tutti i tuoi agenti AI. Più documenti carichi, più precisi e pertinenti saranno nelle loro risposte.

[Mostra schermo — sidebar → Knowledge Base]

Dalla sidebar, vai su "Knowledge Base" o "Documenti di Conoscenza". La pagina è organizzata con un sistema di cartelle e supporta sia la visualizzazione a lista che a griglia.

I documenti sono divisi in tre sezioni: "Sistema" per le istruzioni ad alta priorità che vengono iniettate direttamente nel prompt dell'AI; "Google Drive" se hai collegato il tuo Drive; e "Caricati" per i file che hai uploadato manualmente.

[Mostra schermo — upload documenti]

Per caricare un documento, hai tre opzioni. La prima è il drag-and-drop: trascina un file direttamente nella pagina. I formati supportati sono PDF, Word, file di testo, fogli Excel, e persino file audio che vengono trascritti automaticamente.

La seconda è l'integrazione con Google Drive: se hai collegato il tuo account Google, puoi navigare le cartelle del Drive e importare documenti direttamente.

La terza è l'inserimento manuale: clicca "Incolla Testo" e puoi digitare o incollare del contenuto con un titolo.

[Mostra schermo — stato del documento]

Dopo il caricamento, ogni documento passa attraverso uno stato: "In caricamento", "In elaborazione" — qui il sistema estrae il testo — e poi "Indicizzato", che significa che l'AI può cercarlo e usarlo. Se c'è un errore durante l'elaborazione, vedrai lo stato "Errore" con il dettaglio.

C'è anche una sezione per assegnare documenti specifici a dipendenti AI specifici. Ad esempio, puoi dire che Millie — la dipendente email — deve usare solo il documento "FAQ Clienti" mentre Echo — il riassuntista — deve accedere a tutti i documenti dei corsi.

---

### Lezione 23 — Primo Corso
**Durata stimata: 4 minuti**

La sezione University ti permette di creare corsi formativi per i tuoi clienti. La struttura è gerarchica: Anno, Trimestre, Modulo, Lezione. Puoi creare tutto manualmente o far generare l'intero percorso all'AI.

[Mostra schermo — sidebar → University]

Dalla sidebar, vai su "University". In alto vedi la panoramica con le statistiche: studenti attivi, tasso di completamento, voto medio, certificati emessi.

Per creare il tuo primo corso, hai due strade.

La prima è la generazione AI. Clicca "Genera Percorso con AI" — il sistema analizzerà i contenuti della tua libreria e creerà automaticamente un percorso strutturato in quattro trimestri, distribuendo le lezioni per difficoltà crescente e prerequisiti logici. Tutto in pochi secondi.

La seconda è la creazione manuale. Clicca "Nuovo Anno", poi dentro l'anno "Nuovo Trimestre", dentro il trimestre "Nuovo Modulo", e dentro il modulo "Nuova Lezione". Per ogni lezione puoi selezionare un contenuto dalla tua libreria — il "Selettore Documenti" ti mostra tutti i materiali disponibili.

Una volta creato il percorso, puoi assegnarlo a specifici clienti. Ogni cliente vedrà il suo percorso personalizzato con i progressi, le lezioni completate e quelle ancora da fare.

---

### Lezione 24 — Primo Esercizio
**Durata stimata: 3 minuti**

Gli esercizi pratici completano il percorso formativo dei tuoi clienti. Possono essere quiz a risposta multipla, vero o falso, domande aperte, o upload di file.

[Mostra schermo — sidebar → Esercizi]

Dalla sidebar, vai su "Esercizi". La pagina ha due modalità di visualizzazione: "Lista" per vedere tutti gli esercizi, e "Per Cliente" per vedere cosa è assegnato a ciascun cliente.

Per creare il tuo primo esercizio, puoi farlo manualmente o usare l'AI.

Manualmente: clicca "Nuovo Esercizio", compila il titolo, la descrizione, e aggiungi le domande una per una. Per ogni domanda scegli il tipo — risposta multipla, vero/falso, o risposta aperta — e se vuoi la correzione automatica, inserisci la risposta corretta.

Con l'AI: usa il "Pannello Generazione AI Esercizi". Seleziona le lezioni su cui basare l'esercizio, scegli la difficoltà — Base, Intermedio, Avanzato — e regola il mix di domande con gli slider. L'AI genera un esercizio completo che puoi poi modificare prima di pubblicarlo.

Una volta che un cliente completa un esercizio, puoi vederlo nella lista con lo stato "Da Revisionare". Apri la revisione, guarda le risposte, dai un voto, e scrivi un feedback. L'AI può anche suggerire feedback automatici basati sulle risposte del cliente.

---

### Lezione 25 — Idee AI per gli Agenti
**Durata stimata: 3 minuti**

Questa funzione usa l'intelligenza artificiale per generare idee creative su come personalizzare e migliorare i tuoi agenti WhatsApp.

[Mostra schermo — sidebar → Agenti WhatsApp → tab Ideas]

Dalla sidebar, vai su "Agenti WhatsApp" e poi clicca il tab "Ideas" nella barra in alto.

Qui trovi un generatore di idee basato sull'AI che analizza il tuo settore, il tuo target e la configurazione attuale dei tuoi agenti, e propone suggerimenti concreti. Ad esempio: nuovi template di messaggi, strategie di qualificazione, approcci per gestire le obiezioni, o modi per personalizzare le risposte in base al livello del cliente.

Per generare le idee, compila il brief — settore, obiettivo, target — e clicca "Genera Idee". Il sistema usa un processo avanzato di ragionamento AI con budget di calcolo alto per produrre idee originali e specifiche per il tuo business.

Le idee generate vengono salvate nella tua libreria e puoi implementarle direttamente nella configurazione degli agenti.

---

### Lezione 26 — Libreria Template WhatsApp
**Durata stimata: 2 minuti**

Nella lezione 7 abbiamo creato il primo template WhatsApp. Adesso è il momento di espandere la libreria con template per tutti gli scenari di comunicazione.

[Mostra schermo — sidebar → Template WhatsApp]

Torna nella pagina Template WhatsApp. Qui puoi importare template predefiniti cliccando "Importa Template Default" — il sistema offre set di template già pronti per diversi ruoli: Setter, Receptionist, Customer Success.

Puoi anche creare template personalizzati per scenari specifici: il promemoria dell'appuntamento, il follow-up dopo una consulenza, l'offerta speciale per i clienti Gold, il messaggio di compleanno, la riattivazione di un lead dormiente.

L'obiettivo è avere una libreria completa che copra tutte le situazioni di comunicazione automatica. Ogni template va inviato all'approvazione di Meta tramite Twilio — il processo lo abbiamo già visto — e una volta approvati saranno disponibili per tutti i tuoi agenti e campagne.

---

## 🚀 Modulo: Avanzato (1 lezione)

---

### Lezione 27 — Video Meeting (TURN Server)
**Durata stimata: 3 minuti**

L'ultima lezione del setup riguarda la configurazione del TURN Server per le videochiamate WebRTC. Questo componente garantisce che le videochiamate funzionino anche quando i partecipanti sono dietro firewall aziendali o reti restrittive.

[Mostra schermo — Setup Wizard → Video Meeting (TURN)]

Nello Setup Wizard, clicca su "Video Meeting (TURN)". Oppure vai in Configurazione, tab "Video Meeting".

Usiamo Metered.ca come provider. Se non hai ancora un account, vai su dashboard.metered.ca e registrati — il piano gratuito include un credito sufficiente per iniziare.

I campi da compilare sono tre.

"API Key Metered.ca" — la trovi nella dashboard di Metered sotto API Keys. È una stringa alfanumerica con trattini.

"Secret Key" — nella stessa pagina di Metered, subito sotto l'API Key.

"Attiva TURN server" — assicurati che il toggle sia su attivo.

Salva e testa la connessione. Se il test passa, le tue videochiamate con i clienti passeranno attraverso il server TURN quando necessario, garantendo una connessione stabile anche in condizioni di rete difficili.

Con questa lezione, il tuo setup è completo al cento per cento. Ventisette su ventisette.

---
---

# PARTE 2 — ACCADEMIA (30 lezioni)

> Queste 30 lezioni sono nel tab "Accademia" della pagina Academy.
> Si completano leggendo il contenuto e cliccando "Segna come completata".

---

## 📡 Modulo 1: Setter AI (3 lezioni)

---

### Lezione 1 — Come funziona il Setter AI
**Durata stimata: 5 minuti**

In questa lezione ti spiego come funziona il Setter AI — il tuo primo punto di contatto automatico con i lead.

Il Setter AI è, in pratica, il tuo receptionist digitale. Lavora ventiquattro ore su ventiquattro, sette giorni su sette, e gestisce i canali WhatsApp e Instagram senza che tu debba fare nulla. Quando un lead ti scrive, il Setter risponde immediatamente, qualifica il contatto, e se è in target, prenota un appuntamento nel tuo calendario.

Facciamo un esempio concreto. Immagina che un potenziale cliente ti trovi su Instagram, vada nella tua bio e clicchi il link dell'agente. Scrive "Ciao, vorrei informazioni sui vostri servizi di consulenza". Il Setter AI riceve il messaggio, analizza il contesto — chi è il lead, da dove arriva, cosa ha scritto — e risponde in modo naturale e professionale, come farebbe un collaboratore preparato.

Ma non si limita a rispondere. Durante la conversazione, il Setter fa tre cose fondamentali. Prima: qualifica il lead. Usando il framework BANT — Budget, Autorità, Necessità, Tempistica — capisce se questa persona è un potenziale cliente reale o solo un curioso. Seconda: presenta i tuoi servizi. Basandosi sulla tua Brand Voice e la Knowledge Base, spiega cosa fai, come lo fai e perché sei diverso dalla concorrenza. Terza: propone un appuntamento. Se il lead è qualificato, il Setter controlla il tuo calendario e offre slot disponibili.

[Mostra schermo — pagina Agenti WhatsApp]

Per vedere il Setter in azione, vai su "Agenti WhatsApp" dalla sidebar. Qui trovi la lista dei tuoi agenti con le statistiche: messaggi gestiti, appuntamenti prenotati, tasso di qualificazione.

Il punto di forza del Setter è che impara continuamente. Più conversazioni gestisce, più il contesto che accumula migliora la qualità delle risposte. E tu puoi sempre intervenire: leggere le conversazioni, correggere il tiro, aggiornare le istruzioni.

---

### Lezione 2 — Configurare il primo agente inbound
**Durata stimata: 6 minuti**

Adesso vediamo nel dettaglio come creare e configurare il tuo primo agente inbound. Questo è un processo passo-passo che richiede circa quindici minuti la prima volta, ma una volta capito il meccanismo, potrai crearne di nuovi in pochi minuti.

[Mostra schermo — Agenti WhatsApp → Nuovo Agente]

Dalla sidebar, vai su "Agenti WhatsApp" e clicca "Nuovo Agente". Si apre un wizard a cinque step.

Step uno: Configurazione Base. Dai un nome chiaro all'agente — qualcosa che ti aiuti a riconoscerlo, come "Receptionist Principale" o "Setter Instagram". Come tipo, seleziona "Receptionist (Inbound)" per un agente che risponde ai messaggi in arrivo.

Scegli la modalità: "WhatsApp + Agente AI" per il funzionamento completo con messaggi reali, oppure "Solo Agente AI" se vuoi prima fare dei test senza inviare messaggi veri. Il mio consiglio è partire in modalità test, verificare che le risposte ti soddisfino, e poi passare alla modalità completa.

Attiva il "Dry Run Mode" se vuoi sicurezza extra: in questa modalità l'agente elabora tutto ma non invia realmente i messaggi.

Step due: Disponibilità. Configura gli orari — io suggerisco di impostare le otto-venti nei giorni feriali per cominciare. Scrivi un messaggio per chi scrive fuori orario — sii gentile ma chiaro: "Grazie per averci scritto, ti risponderemo domani mattina."

In questo step attiva la "Prenotazione Appuntamenti" — è la funzione killer. E se lavori in settori con obiezioni frequenti, attiva anche la "Gestione Obiezioni".

Step tre: Brand Voice. Questo step è cruciale. Compila ogni campo con cura. Il nome della tua attività, la tua bio professionale — non due righe, scrivi un paragrafo solido. La descrizione del business deve essere completa. Nella sezione "Autorità e Credibilità", inserisci la tua USP — cosa ti rende unico rispetto alla concorrenza — e i risultati concreti che hai ottenuto.

Il pezzo più importante è la Knowledge Base all'interno del Brand Voice. Carica qui tutti i documenti rilevanti: brochure dei servizi, FAQ, listino prezzi, casi studio. Più materiale dai all'agente, più sarà in grado di rispondere con precisione.

Step quattro: Livelli. Per un primo agente inbound, attiva almeno il livello Bronze. Questo permette a chiunque con il link pubblico di chattare. Se hai già clienti Silver e Gold, personalizza le istruzioni per ogni livello.

Step cinque: Istruzioni AI. Scegli come l'agente si presenta — come "assistente di" è la scelta più sicura per iniziare. Come personalità, "Amico Fidato" funziona bene nella maggior parte dei settori. Poi nel pannello istruzioni, seleziona il template "Receptionist" come base e personalizzalo con le specifiche del tuo business.

Clicca "Crea Agente" e fai subito un test: manda un messaggio WhatsApp al numero collegato e verifica che l'agente risponda come ti aspetti.

---

### Lezione 3 — Strategia di qualifica lead
**Durata stimata: 4 minuti**

Una volta creato l'agente, la domanda diventa: come faccio a far sì che qualifichi i lead in modo intelligente? In questa lezione parliamo del framework BANT e di come configurare l'agente per usarlo efficacemente.

Il framework BANT valuta quattro dimensioni del lead. Budget: ha le risorse economiche per il tuo servizio? Autorità: è la persona che decide o deve chiedere a qualcun altro? Necessità: ha un problema reale che tu risolvi? Tempistica: vuole agire adesso o tra sei mesi?

[Mostra schermo — Agenti WhatsApp → modifica agente → Istruzioni AI]

Per implementare BANT nel tuo agente, apri la configurazione dell'agente e vai alle Istruzioni AI. Nel pannello istruzioni, aggiungi un blocco dedicato alla qualifica. Qualcosa come: "Durante la conversazione, valuta il lead su queste quattro dimensioni. Non fare domande dirette tipo 'Qual è il tuo budget?' — è invadente. Invece, fai domande naturali come 'Ha già investito in soluzioni simili in passato?' per il budget, o 'Quali sono le tempistiche del suo progetto?' per la tempistica."

L'agente imparerà a intrecciare queste domande nella conversazione in modo naturale. Basandosi sulle risposte, assegnerà internamente un punteggio di qualificazione che potrai vedere nel CRM.

Un suggerimento avanzato: nella sezione Brand Voice, carica un documento con i tuoi "criteri di qualificazione ideali" — il profilo del cliente perfetto, le obiezioni più comuni e come gestirle, i segnali di acquisto da riconoscere. L'agente userà queste informazioni per qualificare meglio.

Infine, integra la qualifica con il funnel di vendita. Nella sezione "Disponibilità", attiva la "Disqualificazione Lead" — così l'agente chiuderà gentilmente le conversazioni con lead chiaramente fuori target, senza sprecare tempo.

---

## 🤖 Modulo 2: Dipendenti AI (3 lezioni)

---

### Lezione 4 — I 9 Dipendenti AI — Chi sono e cosa fanno
**Durata stimata: 6 minuti**

La piattaforma ti mette a disposizione un team di nove dipendenti AI, ognuno specializzato in un'area specifica del tuo business. Vediamoli uno per uno.

[Mostra schermo — AI Autonomo → tab Dipendenti]

Dalla sidebar, vai su "AI Autonomo" e poi clicca il tab "Dipendenti".

La prima è Alessia, la tua consulente vocale. Alessia gestisce le chiamate telefoniche — può chiamare i lead per te, rispondere alle chiamate in entrata tramite il centralino AI, e prenotare appuntamenti durante la conversazione telefonica. Pensa a lei come alla tua segretaria telefonica, ma con le competenze di una venditrice esperta.

Poi c'è Millie, la scrittrice di email. Millie monitora la tua inbox, classifica le email per tipo e urgenza, e scrive bozze di risposta. Se un cliente ti scrive una domanda, Millie cerca la risposta nella tua Knowledge Base e prepara una bozza professionale. Tu devi solo approvare e inviare — o configurare l'invio automatico se ti fidi del suo giudizio.

Echo è il riassuntista. Dopo ogni consulenza, Echo analizza la trascrizione e produce un'email riassuntiva strutturata con i punti chiave, le azioni concordate e le scadenze. È il dipendente che ti libera dal compito più noioso dopo ogni call.

Nova è la social media manager. Gestisce il tuo calendario editoriale, propone contenuti basati sulle tue idee e sugli argomenti trending del tuo settore, e può schedulare i post su più piattaforme.

Stella è l'assistente WhatsApp. Monitora le conversazioni dei tuoi agenti e suggerisce azioni proattive — ad esempio, se un lead non risponde da tre giorni, Stella può proporre un follow-up.

Marco è il coach esecutivo. Non lavora con i clienti — lavora con te. Analizza le tue performance, i tuoi KPI, e ti dà consigli strategici. Può sembrare strano avere un AI che ti fa coaching, ma ti assicuro che avere un occhio esterno sui tuoi numeri è potente.

Robert è il coach vendite. Come Marco lavora con te, ma è focalizzato sulle vendite. Analizza le tue conversioni, identifica dove perdi clienti nel funnel, e suggerisce strategie per migliorare.

Hunter è il prospettore di lead. Cerca su Google Maps e sui motori di ricerca aziende che corrispondono al tuo target, le arricchisce con dati dal web, assegna un punteggio di compatibilità AI, e le presenta pronte per il contatto.

Leonardo è l'architetto dei funnel. Analizza la tua Brand Voice, le tue ricerche di mercato, e progetta funnel di conversione personalizzati. Propone la struttura ideale per convertire lead freddi in clienti paganti.

Ognuno di questi dipendenti lavora in autonomia durante gli orari che configuri, e propone le sue azioni nella dashboard Kanban che abbiamo visto prima.

---

### Lezione 5 — Attivare e configurare l'AI Autonomo
**Durata stimata: 4 minuti**

Adesso vediamo come attivare questo team e configurarlo in base alle tue esigenze.

[Mostra schermo — AI Autonomo → tab Impostazioni]

Vai su "AI Autonomo" e clicca il tab "Impostazioni".

Il primo controllo è il toggle principale "Attiva Autonomia". Quando lo accendi, i dipendenti AI iniziano a lavorare. Ma non tutti insieme — puoi controllare ognuno individualmente.

Subito sotto trovi la configurazione degli orari lavorativi. Imposta l'orario di inizio — ad esempio le otto — e l'orario di fine — ad esempio le venti. Poi seleziona i giorni della settimana: lunedì, martedì, mercoledì, giovedì e venerdì per una settimana lavorativa standard. I dipendenti non lavoreranno nei weekend o fuori dall'orario impostato.

[Mostra schermo — lista dipendenti con toggle individuali]

Nella lista dei dipendenti, ogni scheda ha un toggle "Attivo / In pausa". Il mio suggerimento è questo: non attivare tutti i nove dipendenti dal primo giorno. Parti con due o tre — quelli più utili per la tua situazione attuale.

Se hai già clienti e fai consulenze, parti con Echo per i riassunti e Millie per le email. Se sei in fase di acquisizione, parti con Hunter per trovare lead e Stella per monitorare le conversazioni WhatsApp. Poi aggiungi gli altri man mano che prendi confidenza con il sistema.

La modalità di approvazione è un altro punto importante. All'inizio ti consiglio la modalità "Con approvazione" — ogni task proposto dai dipendenti resta in attesa nella colonna "Da Approvare" finché tu non lo confermi. Quando ti senti sicuro che le azioni sono appropriate, puoi passare alla modalità "Automatica" per singoli dipendenti.

---

### Lezione 6 — Monitorare e gestire i task AI
**Durata stimata: 4 minuti**

Ora che il team è attivo, devi imparare a monitorare il loro lavoro e gestire i task.

[Mostra schermo — AI Autonomo → tab Dashboard]

Vai su "AI Autonomo", tab "Dashboard". Questa è la tua board Kanban con quattro colonne.

La colonna "Da Approvare" contiene i task proposti dai dipendenti AI che aspettano la tua decisione. Ogni task mostra il nome del dipendente che lo propone, la descrizione dell'azione, e il ragionamento — cioè perché l'AI pensa che questa azione sia necessaria.

Facciamo un esempio: Millie ha proposto di rispondere a un'email di un cliente che chiede informazioni sui tuoi servizi. Nella scheda del task vedi: l'email originale, la bozza di risposta di Millie, e il suo ragionamento — "Il cliente ha chiesto informazioni sul servizio Premium. Ho trovato la risposta nella Knowledge Base, documento FAQ-Servizi pagina 3. Confidenza: 87 per cento."

A questo punto hai tre opzioni. "Approva": il task passa alla colonna "Programmati" e verrà eseguito. "Modifica": apri la bozza, fai le tue correzioni, e poi approvi. "Rifiuta": il task viene eliminato e il dipendente impara che quel tipo di azione non è desiderata.

La colonna "Programmati" mostra i task approvati in attesa di esecuzione. La colonna "In Corso" mostra quelli che si stanno eseguendo in questo momento. E "Completati" mostra lo storico con l'esito — successo o fallimento.

[Mostra schermo — tab Attività]

Il tab "Attività" è un log cronologico di tutto ciò che è successo. Puoi filtrare per dipendente, per stato, per data. È utile per fare retrospettive settimanali e capire quali dipendenti stanno performando meglio e quali hanno bisogno di aggiustamenti nelle istruzioni.

---

## 🎯 Modulo 3: Hunter (3 lezioni)

---

### Lezione 7 — Come funziona il Lead Scraper
**Durata stimata: 5 minuti**

Il Lead Scraper — noto anche come Hunter — è il tuo strumento di prospecting automatico. Cerca aziende su Google Maps e sui motori di ricerca, raccoglie i loro dati di contatto, arricchisce le informazioni con dati dal loro sito web, e assegna un punteggio di compatibilità AI.

[Mostra schermo — sidebar → Lead Scraper]

Dalla sidebar, vai su "Lead Scraper". La pagina ha tre tab principali: "Ricerca", "CRM" e "Hunter".

Il tab "Ricerca" è dove tutto inizia. Il concetto è semplice: dici al sistema cosa cerchi e dove, e lui trova le aziende che corrispondono.

Facciamo un esempio pratico. Supponiamo che tu sia un consulente per ristoranti e vuoi trovare ristoranti a Milano. Nel campo query scrivi "ristoranti" e nel campo location scrivi "Milano". Puoi scegliere il motore di ricerca — Google Maps è ottimo per le attività locali, Google Search è meglio per aziende online.

Quando lanci la ricerca, il sistema fa tre cose. Prima: cerca le aziende su Google Maps o Google Search e raccoglie nome, indirizzo, telefono, email, sito web e recensioni. Seconda: per ogni azienda trovata, visita il sito web e estrae informazioni aggiuntive — servizi offerti, dimensione, parole chiave. Terza: l'AI analizza tutte queste informazioni e assegna un punteggio di compatibilità da zero a cento.

I risultati appaiono in una tabella con colonne per il nome dell'azienda, i contatti disponibili — icone per email, telefono e sito — il rating Google, e la barra del punteggio AI. Le aziende con punteggio sopra settanta sono colorate in verde — sono i match migliori. Tra quaranta e settanta in giallo — potenziali interessanti. Sotto quaranta in rosso — probabilmente non in target.

---

### Lezione 8 — Configurare una ricerca lead
**Durata stimata: 4 minuti**

Adesso vediamo come configurare una ricerca efficace per trovare esattamente il tipo di lead che cerchi.

[Mostra schermo — Lead Scraper → tab Ricerca]

Nel tab "Ricerca", partiamo dai campi di input.

Il campo "Query" è il più importante. Non scrivere una parola generica — sii specifico. Invece di "consulenti", scrivi "consulenti finanziari indipendenti" o "studi di commercialisti con più di 10 dipendenti". Il sistema ha anche un autocomplete AI che ti suggerisce query correlate mentre scrivi.

Il campo "Location" supporta la normalizzazione automatica — se scrivi "MI" lo converte in "Milano", se scrivi "Roma centro" capisce la zona. Puoi anche impostare un raggio di ricerca.

Poi c'è il "Limite" — quanti lead vuoi trovare. Il default è venti, ma puoi alzarlo fino a cento. Attenzione: ricerche più grandi richiedono più tempo.

La "Modalità di Ricerca" ha tre opzioni. "Solo Cerca" fa la ricerca base senza arricchimento — è veloce ma ti dà solo le informazioni di base. "Predefinito" aggiunge il web scraping e l'analisi AI — è la modalità consigliata. "Cerca + Outreach" fa tutto quanto e in più crea automaticamente i task di contatto per ogni lead trovato — questa è la modalità più aggressiva.

[Mostra schermo — filtri avanzati]

Dopo la ricerca, puoi usare i filtri per raffinare i risultati. Filtra per presenza di email o telefono — utile se vuoi solo lead contattabili. Filtra per rating minimo — magari vuoi solo ristoranti con almeno quattro stelle. Filtra per categoria o per parole chiave specifiche.

L'ordinamento ti permette di mettere in cima i lead con il punteggio AI più alto, oppure quelli con il rating migliore, o semplicemente in ordine alfabetico.

Prima di lanciare ogni ricerca, il sistema ti mostra un riepilogo di conferma con tutti i parametri. Controllalo attentamente e poi clicca "Conferma e Cerca".

---

### Lezione 9 — Gestire i lead e avviare il contatto
**Durata stimata: 5 minuti**

Una volta trovati i lead, è il momento di contattarli. Il sistema supporta una pipeline multi-canale — puoi raggiungerli via WhatsApp, chiamata vocale o email, tutto dalla stessa interfaccia.

[Mostra schermo — Lead Scraper → tab CRM]

Nel tab "CRM" trovi tutti i lead salvati dalle tue ricerche. La sidebar a sinistra ti permette di filtrare per stato: "Nuovo", "Contattato", "In Trattativa", "Convertito" o per canale specifico — WhatsApp, Voce, Email.

Per contattare un lead, clicca sul suo nome. Si apre un pannello dettaglio con tutte le informazioni raccolte. In basso trovi il bottone "Analizza con Hunter" che apre il dialog di outreach.

[Mostra schermo — dialog outreach]

Nel dialog, scegli il canale di contatto. "Chiamata Vocale" attiverà Alessia AI che chiamerà il numero del lead con un pitch personalizzato. "WhatsApp" invierà un messaggio tramite il tuo agente outbound usando un template approvato. "Email" genererà un'email personalizzata basata sulle informazioni raccolte dal sito web del lead.

Puoi anche fare azioni batch — seleziona più lead dalla lista, clicca "Approva in blocco", e il sistema creerà i task di outreach per tutti.

[Mostra schermo — tab Hunter]

Nel tab "Hunter" monitori i task di outreach attivi. Vedi lo stato di ogni contatto: "In Attesa" per quelli programmati, "In Corso" per quelli in esecuzione, "Completato" per quelli finalizzati. Puoi espandere ogni task per leggere la bozza del messaggio che l'AI ha preparato — l'email completa o il testo del WhatsApp — e approvarla, modificarla o rifiutarla.

La cosa potente è che questo non è un sistema "spara e dimentica". Se un lead non risponde al primo contatto, il sistema può programmare automaticamente un follow-up dopo qualche giorno — un messaggio diverso, magari su un canale diverso. Questo approccio multi-touch e multi-canale aumenta drasticamente i tassi di risposta.

---

## 📧 Modulo 4: Email Journey (3 lezioni)

---

### Lezione 10 — Come funziona il Nurturing Email
**Durata stimata: 4 minuti**

Il nurturing email è la strategia che mantiene viva la relazione con i tuoi lead nel tempo — anche quelli che oggi non sono pronti a comprare. L'idea è semplice: una email al giorno, per trecentosessantacinque giorni, personalizzata con l'intelligenza artificiale.

Perché funziona? Perché la maggior parte dei lead non è pronta a comprare al primo contatto. I dati ci dicono che in media servono sette-dodici interazioni prima che un lead diventi cliente. Il nurturing automatizza queste interazioni senza che tu debba scrivere una sola email.

[Mostra schermo — Configurazione AI → tab Lead Nurturing]

Dalla sidebar, vai su "Configurazione AI", tab "Lead Nurturing".

Nella dashboard vedi le metriche chiave: email inviate, tasso di apertura, tasso di click, e la distribuzione dei lead per temperatura — caldi, tiepidi, freddi. Questi dati ti dicono se il nurturing sta funzionando.

Il sistema classifica automaticamente i lead in base al loro engagement. Un lead che apre e clicca le email accumula punti: sopra dieci punti è "Caldo" — pronto per un contatto diretto. Tra tre e nove è "Tiepido" — sta maturando. Sotto tre è "Freddo" — ha bisogno di più tempo.

Il bello è che il contenuto delle email si adatta alla temperatura. I lead freddi ricevono email educative — contenuti che mostrano la tua competenza. I tiepidi ricevono casi studio e prove sociali. I caldi ricevono proposte dirette e inviti all'azione.

---

### Lezione 11 — Creare la prima sequenza email
**Durata stimata: 5 minuti**

Adesso vediamo come creare e configurare la tua prima sequenza di email automatiche. Il sistema supporta due tipi di sequenze: l'Email Journey post-consulenza e il Nurturing 365.

[Mostra schermo — Configurazione AI → tab AI Email]

Partiamo dall'Email Journey. Dalla sidebar, vai su "Configurazione AI", tab "AI Email" o "Echo", poi "Percorso".

L'Email Journey si attiva automaticamente dopo ogni consulenza. Il sistema genera trentuno email personalizzate — una al giorno per un mese — basate sulla conversazione avuta con il cliente. Non sono email generiche: ogni email riprende un punto specifico discusso durante la consulenza, aggiunge valore, e propone azioni concrete.

La configurazione principale è la scelta tra "Bozza" e "Invio Automatico". In modalità bozza, trovi le email generate nel tab "Bozze Email" dove puoi revisionale una per una. In modalità automatica, partono da sole.

Puoi personalizzare il tono — professionale, amichevole, motivazionale — e il sistema si adatta. C'è anche il campo "Email di Riferimento": se incolli un'email che hai scritto tu e che ti rappresenta, l'AI ne studierà lo stile e cercherà di replicarlo.

[Mostra schermo — Configurazione AI → tab Lead Nurturing → Configurazione]

Per il Nurturing 365, vai nel tab "Lead Nurturing", sotto-tab "Configurazione". Attiva il toggle "Nurturing Automatico", imposta l'ora di invio — le nove di mattina è un buon default — e vai nel sotto-tab "Argomenti".

Qui clicca "Genera Argomenti" e l'AI creerà un piano editoriale completo di trecentosessantacinque argomenti basati sul tuo settore. Puoi personalizzare singoli argomenti, riordinare la sequenza, e aggiungere i tuoi contenuti.

Il sotto-tab "Templates" ti mostra il formato delle email. Il sotto-tab "Variabili" mostra le variabili dinamiche disponibili — nome del lead, nome tuo, settore. E il sotto-tab "Destinatari" ti permette di selezionare quali lead riceveranno il nurturing.

---

### Lezione 12 — Email Hub — Inbox e risposte AI
**Durata stimata: 5 minuti**

L'Email Hub è la tua casella di posta potenziata dall'AI. Non è solo un client email — è un sistema intelligente che classifica, analizza e risponde alle email per te, con l'aiuto di Millie, la tua dipendente AI dedicata alle email.

[Mostra schermo — sidebar → Email Hub]

Dalla sidebar, vai su "Email Hub". La prima cosa da fare, se non l'hai ancora fatto, è collegare il tuo account email. Clicca "Aggiungi Account" e compila i dati. Per Gmail: IMAP è imap.gmail.com porta 993, SMTP è smtp.gmail.com porta 587. Ricorda di usare una App Password, non la tua password normale.

Una volta collegato, le email iniziano a sincronizzarsi e Millie entra in azione.

[Mostra schermo — inbox con badge Millie]

Nella lista email, noterai dei badge colorati accanto ad alcune email. Il badge viola "Millie" significa che l'AI ha già analizzato l'email e preparato una bozza di risposta. Il badge rosso "Urgente" indica email ad alta priorità. Il badge verde "Risposto" indica quelle già gestite.

Clicca su un'email con il badge Millie. Nel pannello a destra, sotto il contenuto dell'email, vedi la sezione "Risposta suggerita da Millie" con un'icona a stelline viola. La bozza include il testo della risposta e un punteggio di confidenza — ad esempio "Confidenza: 92 per cento".

Hai tre bottoni: "Approva e Invia" se la bozza è perfetta; "Modifica" per fare ritocchi; "Rifiuta" per scartarla. Se modifichi spesso le bozze di Millie, col tempo lei imparerà dal tuo stile e le bozze miglioreranno.

[Mostra schermo — impostazioni AI email]

Nelle impostazioni AI dell'Email Hub, puoi configurare il tono di Millie — formale, amichevole, o professionale. Puoi impostare la soglia di confidenza per l'auto-invio: ad esempio, se la metti al novanta per cento, tutte le bozze con confidenza superiore al novanta verranno inviate automaticamente. E puoi definire "Parole di Escalation" — parole chiave che, se presenti in un'email, la convertono automaticamente in un ticket per la tua revisione manuale.

---

## 📋 Modulo 5: Lavoro Quotidiano (3 lezioni)

---

### Lezione 13 — Dashboard e KPI
**Durata stimata: 4 minuti**

La Dashboard è la prima cosa che vedi quando entri nella piattaforma. È il tuo cruscotto quotidiano che ti dà una visione d'insieme di tutto: clienti, appuntamenti, lead, task AI e performance.

[Mostra schermo — sidebar → Dashboard]

Dalla sidebar, clicca su "Dashboard" — di solito è già selezionata quando fai login.

In alto trovi quattro card principali con i tuoi KPI — i numeri che contano.

La prima è "Clienti Attivi" — il numero totale di clienti che hai sulla piattaforma. Con l'indicatore di trend rispetto al mese precedente.

La seconda è "Da Revisionare" — gli esercizi e i compiti dei tuoi clienti che aspettano la tua revisione. Questo numero idealmente dovrebbe essere sempre basso — significa che sei reattivo.

La terza è "Consulenze" — il numero di appuntamenti programmati per questa settimana. Un colpo d'occhio per capire quanto è piena la tua agenda.

La quarta è "Lead Caldi" — i lead con il punteggio più alto, quelli pronti per essere contattati. Questi sono i tuoi soldi pronti sul tavolo.

[Mostra schermo — sezione Azioni Rapide e Onboarding Luca]

Sotto i KPI, trovi le Azioni Rapide: "Chatta con AI" per accedere all'assistente, "Invia Email" per la configurazione email, "Chiama Lead" per il lead hub. E la sezione "Onboarding con Luca" — il tuo agente di delivery che ti guida nella configurazione iniziale del business.

Nella parte bassa, ci sono i widget operativi: "Richiede Attenzione" con le priorità — le cose che devi fare oggi; "Prossimi Appuntamenti" con la timeline dei prossimi quattro incontri; e "Clienti Recenti" con gli ultimi aggiornamenti sui tuoi clienti.

Il consiglio è fare una routine: ogni mattina, apri la Dashboard, guarda i KPI, controlla cosa "Richiede Attenzione", e pianifica la giornata di conseguenza.

---

### Lezione 14 — Gestire appuntamenti e calendario
**Durata stimata: 4 minuti**

La gestione degli appuntamenti è centrale nel lavoro di un consulente. La piattaforma offre un sistema completo che si sincronizza con Google Calendar e permette ai tuoi agenti AI di prenotare automaticamente.

[Mostra schermo — sidebar → Appuntamenti]

Dalla sidebar, vai su "Appuntamenti". La pagina ha diverse viste.

La vista "Calendario Premium" ti mostra il mese con i pallini che indicano le consulenze — blu per gli appuntamenti locali, viola per quelli importati da Google Calendar, e verde acqua per quelli sincronizzati.

La vista "Timeline Settimanale" è come Google Calendar — una griglia oraria dove ogni appuntamento è posizionato nel suo slot temporale. Puoi vedere a colpo d'occhio quando sei libero e quando sei occupato.

[Mostra schermo — creazione appuntamento]

Per creare un nuovo appuntamento, clicca "Nuovo Appuntamento". Seleziona il cliente dalla lista, scegli la data e l'ora, imposta la durata, e aggiungi eventuali note. L'appuntamento apparirà sia qui che nel tuo Google Calendar.

Ma la cosa più potente è il booking automatico. Se hai collegato Google Calendar e attivato la prenotazione nei tuoi agenti, i clienti possono prenotare direttamente durante la conversazione WhatsApp. L'agente controlla i tuoi slot liberi in tempo reale, propone tre opzioni, il cliente sceglie, e l'appuntamento viene creato automaticamente. Tu ricevi solo la notifica.

C'è anche una pagina di booking pubblica — tipo Calendly — che puoi condividere con un link. I clienti vedono la tua disponibilità e prenotano da soli.

Dopo ogni consulenza, ricordati di completare l'appuntamento e di scrivere qualche nota — anche breve. Echo userà quelle note per generare l'email riassuntiva che abbiamo visto nella lezione quindici.

---

### Lezione 15 — CRM — Gestire clienti e contatti
**Durata stimata: 5 minuti**

Il CRM è dove gestisci tutte le persone nel tuo ecosistema — clienti attivi, contatti in fase di qualifica, dipendenti del tuo team, e lead da lead magnet.

[Mostra schermo — sidebar → Clienti]

Dalla sidebar, vai su "Clienti". La pagina ha due tab principali in alto: "Clienti" e "Monitoraggio".

Nel tab "Clienti" trovi tutti i tuoi contatti, suddivisi per tipo. Usa i filtri in alto per navigare: "Clienti" per i paganti con accesso alla piattaforma, "Contatti CRM" per i lead e prospect senza account, "Dipendenti" per i membri del tuo team, e "Lead Magnet" per chi è entrato tramite un tool di acquisizione.

[Mostra schermo — profilo cliente]

Clicca su un cliente per aprire il suo profilo. Qui trovi tutto: dati anagrafici, email, telefono, lo storico delle conversazioni WhatsApp, gli appuntamenti passati e futuri, gli esercizi assegnati, le email inviate, e le note dell'AI.

Le azioni rapide nel profilo includono: inviare un messaggio WhatsApp, schedulare un appuntamento, assegnare un esercizio, modificare i dati, e attivare o disattivare l'account.

[Mostra schermo — conversione CRM → Cliente]

Il flusso di conversione da "Contatto CRM" a "Cliente pagante" funziona così. Hai un contatto nel CRM — magari è arrivato da una campagna o l'hai inserito manualmente. Apri il suo profilo, clicca il menu "Altro" e seleziona "Genera Link Pagamento". Si apre un dialog dove scegli il livello — Silver o Gold — e il tipo di fatturazione — mensile, annuale, o una tantum. Il sistema genera un link Stripe Checkout che puoi inviare al contatto.

Quando il contatto paga, tutto succede in automatico: Stripe avvisa la piattaforma tramite webhook, il sistema crea l'account utente, assegna il livello, e attiva l'onboarding. Il contatto CRM diventa un cliente attivo senza che tu debba fare niente.

---

## 🎓 Modulo 6: Formazione & Corsi (3 lezioni)

---

### Lezione 16 — Creare un corso per i tuoi clienti
**Durata stimata: 5 minuti**

La sezione University è dove crei il percorso formativo per i tuoi clienti. La struttura è gerarchica: Anno, Trimestre, Modulo, Lezione. Puoi costruire tutto manualmente o delegare la struttura all'AI.

[Mostra schermo — sidebar → University]

Dalla sidebar, vai su "University". La pagina si apre con una panoramica che mostra le statistiche globali: quanti studenti hai, il tasso di completamento medio, il voto medio, e i certificati emessi.

[Mostra schermo — crea un percorso con AI]

Per creare il tuo primo corso, il modo più veloce è usare la generazione AI. Clicca "Genera Percorso con AI" e il sistema analizzerà la tua libreria di contenuti — se ne hai — e creerà automaticamente una struttura in quattro trimestri. Ogni trimestre contiene moduli tematici, e ogni modulo contiene lezioni ordinate per difficoltà crescente. L'AI è abbastanza intelligente da capire i prerequisiti: non metterà una lezione avanzata prima di quella base.

Se preferisci il controllo manuale, il flusso è: clicca "Nuovo Anno" per creare il contenitore annuale. Dentro l'anno, clicca "Nuovo Trimestre" — ne crei quattro, uno per stagione. Dentro ogni trimestre, crei i Moduli — i blocchi tematici. E dentro ogni modulo, aggiungi le Lezioni. Per ogni lezione puoi selezionare un contenuto dalla tua libreria di documenti usando il selettore.

[Mostra schermo — assegnazione a un cliente]

Una volta creato il percorso, lo assegni ai clienti. Nella vista "Gestisci Cliente", selezioni il cliente e vedi il suo percorso personalizzato — le lezioni completate, quelle in corso, e quelle ancora bloccate. Puoi sbloccare manualmente le lezioni o lasciare che il sistema le sblocchi progressivamente in base ai completamenti.

I clienti Gold vedranno il percorso completo nella loro area personale con il tracking dei progressi, e potranno guadagnare certificati al completamento di ogni trimestre.

---

### Lezione 17 — Esercizi pratici e valutazione
**Durata stimata: 4 minuti**

Gli esercizi completano la formazione con la pratica. Sono il modo per verificare che i tuoi clienti abbiano davvero capito e applicato quello che hai insegnato.

[Mostra schermo — sidebar → Esercizi]

Dalla sidebar, vai su "Esercizi". La pagina mostra tutti gli esercizi che hai creato, con lo stato: bozza, assegnato, in corso, completato, o da revisionare.

Per creare un esercizio manualmente, clicca "Nuovo Esercizio". Dai un titolo, una descrizione, e inizia ad aggiungere le domande. Ogni domanda può essere di tipo: "Risposta Multipla" con opzioni predefinite — e puoi indicare quella corretta per la correzione automatica; "Vero o Falso"; oppure "Risposta Aperta" dove il cliente scrive liberamente.

Per ogni esercizio puoi configurare se è un "Esame" — con voto minimo per passare — o un semplice esercizio pratico senza voto.

[Mostra schermo — generazione AI esercizi]

Ma il modo più potente è la generazione AI. Clicca "Genera con AI" e si apre il pannello di generazione. Qui selezioni le lezioni su cui basare l'esercizio — ad esempio le lezioni del primo trimestre. Scegli la difficoltà: Base, Intermedio, o Avanzato. E regoli il mix con gli slider: quante domande a risposta multipla, quante vero o falso, quante a risposta aperta. Puoi anche personalizzare lo stile di scrittura e aggiungere istruzioni specifiche.

L'AI genera l'esercizio completo in background — lo trovi pronto in pochi minuti. Prima di pubblicarlo, puoi rivederlo e modificare qualsiasi domanda.

Quando un cliente completa l'esercizio, lo trovi nella tua lista con lo stato "Da Revisionare". L'AI può anche suggerirti un feedback basato sulle risposte — ma la parola finale è sempre tua.

---

### Lezione 18 — Gamification e motivazione
**Durata stimata: 4 minuti**

La gamification è il sistema che tiene i tuoi clienti motivati e coinvolti nel percorso formativo. Funziona con punti XP, livelli, badge e streak — gli stessi meccanismi che rendono coinvolgenti le app più popolari.

[Mostra schermo — Momentum Dashboard]

La piattaforma usa un sistema chiamato "Momentum" per tracciare la produttività e il coinvolgimento. Funziona sia per te come consulente che per i tuoi clienti.

I punti XP si guadagnano completando azioni: finire una lezione, completare un esercizio, rispondere a un check-in. Accumulando punti, si sale di livello — il sistema prevede quattro livelli: Studente, Esperto, Mentor, e Master.

I badge sono riconoscimenti speciali per traguardi significativi. "Prima Lezione" quando completi la prima lezione del percorso. "Primo Trimestre" quando finisci un intero trimestre. "Perfezionista" per chi prende il massimo dei voti. "Velocista" per chi completa tutto in tempi record. Ogni badge ha un'icona animata e un gradiente colorato — sono pensati per dare soddisfazione visiva.

[Mostra schermo — Streak e Check-in]

Le streak sono le serie consecutive di giorni attivi. Ogni giorno che un utente fa un check-in produttivo — compila un breve log di attività con descrizione, stato e umore — la streak aumenta. Dopo tre giorni consecutivi appare un messaggio "Ottimo lavoro, continua così!" e dopo sette giorni "Incredibile! Straordinario!". Il tutto con un'icona fiamma e un'animazione pulsante.

Il sistema di check-in chiede anche l'umore — da uno a cinque con emoji — e il livello di energia — da uno a cinque con icone batteria. Questi dati ti permettono, come consulente, di capire non solo se il cliente sta lavorando, ma anche come si sente. Se un cliente ha tre giorni di umore basso, forse è il momento di una chiamata.

I tuoi clienti Gold vedranno anche la classifica — chi è in testa nel gruppo, chi ha la streak più lunga, chi ha più badge. La competizione amichevole è un motore potente di engagement.

---

## 🎨 Modulo 7: Content Studio (3 lezioni)

---

### Lezione 19 — AdVisage AI — La fabbrica creativa
**Durata stimata: 6 minuti**

AdVisage AI è il tuo studio di produzione creativa per le inserzioni pubblicitarie. Non genera solo immagini — analizza il tuo testo pubblicitario in profondità, estrae il gancio emotivo, e produce concept visivi professionali pronti per Meta e Instagram.

[Mostra schermo — sidebar → Content Studio → AdVisage]

Dalla sidebar, vai su "Content Studio" e poi "AdVisage". La pagina si divide in due modalità: "Fabbrica" per la produzione e "Pitch" per la revisione e selezione dei risultati.

[Mostra schermo — area input testi]

Nella modalità Fabbrica, partiamo dall'input. In alto hai l'area di caricamento dei testi pubblicitari. Puoi inserirli in tre modi: scriverli manualmente nell'editor — puoi aggiungere più testi alla coda; importarli dal CRM se hai già dei post nel sistema; o recuperarli da una fonte esterna.

Ogni testo va associato a una piattaforma — Instagram, Facebook, eccetera — perché il formato dell'immagine finale cambia in base al canale.

[Mostra schermo — impostazioni stili]

Sotto l'area testi, configuri lo stile visivo. Puoi farlo in due modi. La modalità "Manuale" ti dà il controllo completo: scegli il Mood — professionale, lusso, energetico; lo Stile Artistico — realistico, 3D render, illustrazione; l'Illuminazione — studio, neon, drammatica; il Color Grading — cinematografico, vintage, vibrante; l'Angolo Camera; e lo Stile Sfondo.

La modalità "Auto" è più veloce: l'AI analizza il testo pubblicitario e determina automaticamente lo stile visivo ottimale. In molti casi la modalità Auto produce risultati eccellenti perché basa le scelte sulle emozioni del testo.

[Mostra schermo — tipi di concept]

La vera potenza di AdVisage è il Multi-Style Engine. Per ogni testo, il sistema genera diversi tipi di concept creativi. "Call Out Benefici" — il prodotto al centro con frecce che evidenziano i vantaggi. "Social Proof Avatar" — una testimonianza cliente in formato social. "Noi vs Competitor" — schermo diviso, rosso per il concorrente, verde per te. "X Ragioni per Acquistare" — lista numerata impattante. "Offerta / Headline USP" — layout diretto ad alta conversione. "Risultato Desiderabile" — immagine aspirazionale che mostra il "dopo".

Per ogni concept, il sistema genera due versioni: "Clean" solo visiva e "Text Overlay" con il gancio testuale sovrapposto.

[Mostra schermo — bottone Inizia Produzione Batch]

Quando tutto è configurato, clicca "Inizia Produzione Batch". Il sistema analizza ogni testo usando il framework di marketing di Frank Merenda, identifica il target, il problema, e il gancio emotivo, e poi genera le immagini. La produzione avviene in parallelo — fino a tre testi contemporaneamente — e puoi monitorare il progresso in tempo reale.

Una volta completata, passa alla modalità "Pitch" per vedere tutti i risultati, selezionare i vincitori, e esportarli.

---

### Lezione 20 — Ideas Generator e calendario editoriale
**Durata stimata: 5 minuti**

L'Ideas Generator è il tuo partner creativo per il content marketing. Usa l'AI per generare idee di contenuto personalizzate basate sul tuo brand, il tuo target e i tuoi obiettivi.

[Mostra schermo — sidebar → Content Studio → Ideas]

Dalla sidebar, vai su "Content Studio" e poi "Ideas". La pagina funziona come un wizard a tre step.

[Mostra schermo — Step 1: Obiettivo e Formato]

Step uno: definisci il tuo obiettivo — Vendite, Awareness, Engagement, o Educazione. Seleziona le piattaforme — Instagram, LinkedIn, X, Facebook. E scegli le categorie di contenuto — Ads, Contenuto di Valore, Educativo.

[Mostra schermo — Step 2: Nicchia e Target]

Step due: definisci la tua nicchia e il tuo pubblico target. C'è una funzione "Deep Research" che può importare automaticamente i dati dalla tua ricerca di mercato fatta con Luca — l'agente di delivery. Se hai già fatto l'onboarding con Luca, troverai i pain points, i desideri notturni, e i profili psicologici del tuo target già pronti.

[Mostra schermo — Step 3: Opzioni Avanzate]

Step tre: opzioni avanzate. Qui scegli il "Livello di Consapevolezza" del target — da "Inconsapevole del problema" a "Molto consapevole e pronto a comprare". E il "Livello di Sofisticazione" — da uno per un mercato vergine a cinque per un mercato saturo. Questi parametri cambiano radicalmente il tipo di idee generate.

C'è anche la sezione Brand Voice dove attivi l'allineamento al tuo tono e scegli lo stile di scrittura — conversazionale, diretto, persuasivo, o personalizzato.

Quando clicchi "Genera Idee", parte un processo di ragionamento profondo — l'AI ci dedica molto tempo di calcolo — e durante l'attesa vedrai un modale di progresso con i sette step della generazione. Il risultato sono idee dettagliate con titolo, formato, angolo comunicativo e outline del contenuto.

[Mostra schermo — tab Calendario]

Il tab "Calendario" ti dà una vista mensile dove pianificare la pubblicazione. Ogni giorno con contenuti programmati ha dei pallini colorati. Clicca su un giorno per vedere i dettagli e aggiungere nuovi eventi manualmente.

---

### Lezione 21 — Pubblicare e monitorare con Publer
**Durata stimata: 3 minuti**

Publer è lo strumento di pubblicazione che ti permette di programmare i tuoi contenuti su più piattaforme social simultaneamente — Instagram, Facebook, LinkedIn, X — tutto dalla piattaforma.

[Mostra schermo — Ideas → contenuti generati]

Una volta generate le idee e preparati i contenuti, nella lista dei post trovi il bottone "Esporta su Publer" accanto a ogni contenuto.

Ma ancora più potente è la pubblicazione in blocco. Clicca "Pubblica in Blocco" e si apre un dialog dove selezioni più post, scegli gli account social di destinazione, e programmi la data e l'ora di pubblicazione per ciascuno.

Il sistema supporta tre modalità: "Bozza" per salvare su Publer senza pubblicare; "Pubblica Ora" per l'invio immediato; e "Programmato" per la pubblicazione futura.

[Mostra schermo — stato sincronizzazione]

Dopo l'invio, il sistema monitora lo stato in background. Ogni cinque minuti controlla su Publer se i post sono stati effettivamente pubblicati. Nella lista vedrai lo stato aggiornato: "Bozza", "Programmato", "Pubblicato", o "Fallito" — con il dettaglio dell'errore se qualcosa non è andato.

Per collegare Publer, vai nella pagina Configurazione e inserisci la tua API Key e il Workspace ID di Publer. Li trovi nella dashboard di Publer sotto Settings, API.

---

## 📞 Modulo 8: Voce AI (3 lezioni)

---

### Lezione 22 — Alessia AI — Le chiamate vocali
**Durata stimata: 5 minuti**

Alessia AI è la tua agente vocale. Può effettuare chiamate telefoniche ai tuoi lead, gestire le chiamate in entrata, e condurre conversazioni complete — qualificazione, presentazione servizi, prenotazione appuntamenti — tutto con la voce.

[Mostra schermo — sidebar → Chiamate Voice]

Dalla sidebar, vai su "Chiamate Voice". In alto trovi il pannello della coda chiamate — un cruscotto in tempo reale che ti mostra cosa sta succedendo.

Le chiamate attive mostrano un contatore di durata che scorre in tempo reale — sai esattamente quanto dura ogni chiamata in corso. Le chiamate programmate hanno un countdown — sai quando partirà la prossima.

C'è anche la coda tentativi: se Alessia chiama un numero e non risponde, il sistema programma automaticamente un nuovo tentativo. E la coda di approvazione: se il dipendente AI Hunter propone di chiamare un lead trovato con lo scraper, la chiamata finisce qui in attesa del tuo via libera.

[Mostra schermo — avvia chiamata manuale]

Per avviare una chiamata manuale, usa l'interfaccia "Nuova Chiamata". Inserisci il numero di telefono e seleziona la modalità: "Assistente" per un tono informativo e di servizio; "Vendita" per un approccio più proattivo con pitch; "Supporto" per assistenza post-vendita.

Alessia chiama il numero, si presenta, e conduce la conversazione seguendo le istruzioni che hai configurato nella sua scheda dipendente nell'AI Autonomo.

[Mostra schermo — sezione Conversazioni]

Nella sezione "Conversazioni" trovi lo storico completo. Ogni chiamata ha una trascrizione dettagliata — i messaggi di Alessia e le risposte del cliente sono separati come in una chat. Puoi leggere esattamente cosa è stato detto. Il sistema rileva automaticamente anche le segreterie telefoniche e le etichetta.

Le statistiche generali mostrano il totale chiamate, il costo stimato, la durata media, e lo stato di salute dei sistemi tecnici.

---

### Lezione 23 — Centralino AI e coda d'attesa
**Durata stimata: 4 minuti**

Oltre alle chiamate outbound, Alessia può funzionare come centralino intelligente per le chiamate in entrata. Quando qualcuno chiama il tuo numero, Alessia risponde, capisce cosa vuole, e lo gestisce automaticamente.

Il centralino AI ha diverse funzionalità. La risposta automatica saluta il chiamante con un messaggio personalizzato — ad esempio "Buongiorno, grazie per aver chiamato lo studio del dottor Rossi. Come posso aiutarla?"

Il riconoscimento dell'intento analizza in tempo reale cosa dice il chiamante e lo classifica: vuole informazioni? Vuole prenotare un appuntamento? Ha un problema urgente?

Il routing intelligente — in base all'intento — può trasferire la chiamata a un operatore umano, gestirla in autonomia, o programmare un callback.

I messaggi fuori orario funzionano come per gli agenti WhatsApp: se qualcuno chiama fuori dagli orari configurati, sente un messaggio gentile che lo invita a richiamare o lasciare un messaggio.

La coda d'attesa gestisce le situazioni in cui tutte le linee sono occupate. Alessia informa il chiamante della posizione in coda e del tempo stimato di attesa. Se l'attesa è troppo lunga, può proporre un callback: "Il nostro consulente la richiamerà entro le prossime due ore. A quale numero preferisce essere ricontattato?"

Tutto questo funziona automaticamente una volta configurato. Nelle impostazioni puoi personalizzare ogni messaggio, definire le regole di routing, e impostare gli orari di attività del centralino.

---

### Lezione 24 — Provisioning numeri VoIP
**Durata stimata: 4 minuti**

Per usare Alessia AI al massimo delle sue potenzialità, hai bisogno di numeri di telefono VoIP dedicati. In questa lezione vediamo come acquistare e configurare numeri tramite Telnyx, il provider VoIP della piattaforma.

[Mostra schermo — sidebar → Numeri Telefono]

Dalla sidebar, vai su "Numeri Telefono" oppure apri la pagina Chiamate Voice e vai nel tab "Provisioning VoIP".

[Mostra schermo — ricerca numeri]

Il primo passo è cercare i numeri disponibili. Puoi filtrare per paese — Italia — e per prefisso. Ad esempio, se vuoi un numero con prefisso di Milano, cerca "02". Se vuoi un numero di Roma, cerca "06". Il sistema mostra i numeri disponibili su Telnyx con il costo mensile.

[Mostra schermo — flusso KYC]

Quando selezioni un numero, parte il processo KYC — Know Your Customer. La normativa italiana richiede la verifica della tua identità prima di attivare un numero telefonico. Il flusso ha quattro passaggi: inserisci i dati aziendali — codice fiscale, partita IVA, indirizzo; carichi i documenti — carta d'identità e prova di indirizzo; invii la richiesta; e attendi l'approvazione.

Lo stato della richiesta viene tracciato nella piattaforma: "In attesa", "Documenti caricati", "KYC inviato", "KYC approvato", "Numero attivo". Di solito l'approvazione richiede da uno a tre giorni lavorativi.

Una volta che il numero è attivo, viene configurato automaticamente nel sistema. Puoi assegnarlo al centralino AI, usarlo per le chiamate outbound di Alessia, o dedicarlo a campagne specifiche. Nella pagina di gestione numeri puoi assegnare un nome descrittivo a ogni numero — ad esempio "Numero Principale" o "Linea Vendite" — e attivarlo o disattivarlo con un toggle.

---

## 💳 Modulo 9: Pagamenti & Stripe (3 lezioni)

---

### Lezione 25 — Il modello di business — Diamond, Gold, Silver
**Durata stimata: 5 minuti**

Prima di parlare di configurazione tecnica, è importante capire il modello di business della piattaforma. È un sistema a tre livelli con rivendita di licenze integrata.

Tu, come consulente Diamond, hai accesso a tutte le funzionalità della piattaforma. I tuoi clienti possono accedere a due livelli: Gold e Silver. Il livello Gold offre l'esperienza completa — accesso a tutti gli strumenti, formazione, AI dedicata. Il Silver è una versione intermedia con funzionalità selezionate.

Il modello economico è semplice e trasparente. Quando vendi una licenza Gold o Silver a un cliente, il ricavo viene diviso al cinquanta per cento: metà a te, metà alla piattaforma. Questo succede automaticamente tramite Stripe Connect — non devi calcolare nulla manualmente.

Facciamo un esempio. Un cliente Gold paga cento euro al mese. Cinquanta euro vengono accreditati direttamente sul tuo conto Stripe, e cinquanta vanno alla piattaforma. Se hai dieci clienti Gold, guadagni cinquecento euro al mese ricorrenti — solo dalle licenze, senza contare il tuo compenso per le consulenze.

La licenza è separata dalla tua consulenza. Puoi vendere la licenza come prodotto standalone — il cliente paga per accedere alla piattaforma e alla formazione — oppure come parte di un pacchetto che include anche le tue ore di consulenza.

[Mostra schermo — sidebar → Stripe Connect]

Il numero di licenze disponibili dipende dal tuo piano Diamond. Nella pagina Clienti puoi vedere il contatore: licenze usate su licenze totali. Se raggiungi il limite, puoi richiedere un upgrade per sbloccare più slot.

Il punto chiave del modello è la ricorrenza. Ogni cliente che acquisti genera revenue mensile automatico. Più clienti hai, più il tuo revenue ricorrente cresce — e nel tempo il business si autoalimenta.

---

### Lezione 26 — Configurare Stripe Connect
**Durata stimata: 4 minuti**

Ora vediamo la configurazione tecnica di Stripe Connect — il sistema che gestisce i pagamenti automatizzati.

[Mostra schermo — Configurazione → tab Stripe]

Dalla pagina Configurazione, vai al tab "Stripe". Trovi un mini-wizard a tre step.

Step uno: Collega Stripe. Clicca "Connetti Stripe" e verrai portato sulla pagina di onboarding Stripe Express. Qui inserisci i tuoi dati: tipo di attività — individuale o azienda — i tuoi dati personali, il conto bancario dove vuoi ricevere i pagamenti, e le informazioni fiscali. Stripe verifica tutto e attiva il tuo account — di solito in pochi minuti.

Step due: Configura Webhook. Questo è il pezzo tecnico che permette alla piattaforma di sapere quando un pagamento va a buon fine. Nella pagina vedrai un URL — copialo. Poi vai nella dashboard di Stripe, sezione "Developers", poi "Webhooks". Clicca "Aggiungi Endpoint", incolla l'URL che hai copiato. Negli eventi da ascoltare, seleziona "checkout.session.completed". Salva e Stripe ti mostrerà un "Webhook Secret" — una stringa che inizia con "whsec_". Copiala e torna nella piattaforma per incollarla nel campo dedicato.

Step tre: Chiavi API. Questo step è opzionale ma consigliato. Dalla dashboard Stripe, sezione "Developers", poi "API Keys", copia la tua "Secret Key" — inizia con "sk_live_" per il modo produzione o "sk_test_" per i test — e incollala nella piattaforma. Questa chiave permette al sistema di creare automaticamente le sessioni di pagamento quando invii un link a un cliente.

Una volta completati tutti e tre gli step, sei pronto per ricevere pagamenti. Il sistema crea automaticamente i checkout, divide il ricavo, e attiva i clienti — tutto senza intervento manuale.

---

### Lezione 27 — Vendere licenze ai clienti
**Durata stimata: 4 minuti**

Con Stripe configurato, vediamo il flusso completo per vendere una licenza a un cliente — dal primo contatto alla conversione automatica.

[Mostra schermo — sidebar → Clienti]

Dalla sidebar, vai su "Clienti".

Il flusso tipico inizia con un contatto CRM. Puoi creare un contatto manualmente — clicca "Nuovo Contatto", inserisci nome, email e telefono — oppure il contatto arriva automaticamente da una campagna, dal lead scraper, o da un'importazione.

[Mostra schermo — profilo contatto CRM → menu Altro]

Apri il profilo del contatto. Clicca il menu "Altro" e seleziona "Genera Link Pagamento".

Si apre un dialog con due scelte principali. La prima è il livello: Silver o Gold. La seconda è il tipo di fatturazione: Mensile per il pagamento ricorrente, Annuale per un pagamento unico con sconto, o Una Tantum per un accesso limitato nel tempo.

[Mostra schermo — link generato]

Il sistema genera un link Stripe Checkout personalizzato. Puoi copiarlo e inviarlo al contatto via WhatsApp, email, o qualsiasi altro canale.

Quando il contatto clicca il link, vede una pagina di pagamento Stripe professionale con il dettaglio del servizio e il prezzo. Inserisce i dati della carta e paga.

[Mostra schermo — conversione automatica]

A questo punto la magia dell'automazione si attiva. Stripe invia la notifica alla piattaforma tramite il webhook. Il sistema riceve la conferma di pagamento, identifica il contatto CRM tramite i metadati, crea automaticamente un account utente con username e password, gli assegna il livello — Silver o Gold — e attiva l'onboarding. Il contatto CRM diventa un cliente attivo.

Tu ricevi una notifica che un nuovo cliente è stato attivato, e la tua quota di licenze si aggiorna automaticamente. Il revenue sharing è già gestito: la tua parte arriva sul tuo conto Stripe secondo i tempi standard di Stripe — di solito entro due-sette giorni lavorativi.

---

## 👥 Modulo 10: Team & Dipendenti (3 lezioni)

---

### Lezione 28 — Creare reparti e organizzare il team
**Durata stimata: 4 minuti**

Se lavori con un team — assistenti, collaboratori, altri professionisti — la piattaforma ti permette di organizzarli in reparti con ruoli e permessi specifici. Ogni membro del team ha anche accesso al proprio AI personalizzato.

[Mostra schermo — sidebar → Clienti → tab Dipendenti]

Dalla sidebar, vai su "Clienti" e poi clicca la sottosezione "Dipendenti". Qui vedi la lista dei membri del tuo team.

Per creare un reparto, usa la sezione "Reparti" in alto. Clicca "Nuovo Reparto" e dai un nome — ad esempio "Vendite", "Supporto", "Marketing". Ogni reparto ha un colore identificativo per distinguerlo rapidamente nella lista.

Per aggiungere un membro del team, clicca "Nuovo Dipendente". Inserisci nome, email e telefono. Poi assegna il reparto e il ruolo. I ruoli definiscono cosa il membro può vedere e fare nella piattaforma.

Ogni membro del team, una volta creato, riceve le credenziali di accesso e può entrare nella piattaforma con la sua area personale. La cosa potente è che ogni membro ha il suo AI assistente personalizzato — che si adatta al suo ruolo e alle sue responsabilità.

La struttura organizzativa è visibile nella pagina: reparti con i loro membri, ognuno con il ruolo, lo stato — attivo o inattivo — e le statistiche di attività.

---

### Lezione 29 — Gestire le licenze
**Durata stimata: 3 minuti**

Le licenze sono il meccanismo che regola quanti utenti puoi avere sulla piattaforma. Capire come funzionano è fondamentale per pianificare la crescita del tuo business.

[Mostra schermo — sidebar → Piano]

Dalla sidebar, vai su "Piano". Qui vedi il quadro completo delle tue licenze.

Il contatore principale mostra: licenze usate su licenze totali. Ad esempio, "12/20" significa che stai usando dodici delle venti licenze disponibili. Le licenze si consumano quando crei clienti o dipendenti — ogni persona attiva nel sistema occupa una licenza.

I contatori sono divisi per tipo: "Silver" per i clienti di livello due, "Gold" per i clienti di livello tre, e "Dipendenti" per i membri del tuo team.

Un dettaglio importante: i contatti CRM non consumano licenze. Puoi avere migliaia di contatti nel CRM senza impatto sulle tue licenze. Le licenze si consumano solo quando un contatto viene convertito in utente attivo — cioè quando ha un account con credenziali di accesso.

Se raggiungi il limite di licenze, il sistema non ti blocca dal aggiungere contatti al CRM — continui a lavorare normalmente. Ma non potrai convertire nuovi contatti in clienti attivi finché non liberi una licenza disattivando un utente esistente, o non richiedi un upgrade del tuo piano.

La strategia intelligente è questa: usa i contatti CRM per gestire la relazione e il nurturing con i lead. Converti in clienti attivi — consumando licenze — solo quelli che hanno pagato o che sei sicuro diventeranno paganti.

---

### Lezione 30 — Multi-profilo e accesso multi-consulente
**Durata stimata: 3 minuti**

L'ultima lezione riguarda una funzionalità avanzata: la gestione multi-profilo. Nel sistema, un utente può essere cliente di più consulenti contemporaneamente. Vediamo come funziona.

[Mostra schermo — sidebar → Clienti → profilo cliente]

Immagina questo scenario: Mario Bianchi è un imprenditore che si rivolge a te per consulenza marketing e a un altro professionista sulla piattaforma per consulenza finanziaria. Mario ha un unico account — un solo username e password — ma vede due "profili" separati, uno per ogni consulente.

Quando Mario fa login, il sistema gli mostra i consulenti a cui è collegato. Seleziona il tuo nome e vede il suo percorso formativo, i suoi esercizi, le sue conversazioni con i tuoi agenti. Se poi cambia profilo selezionando l'altro consulente, vede un contesto completamente diverso.

Dal tuo punto di vista, nel profilo di un cliente puoi vedere se è collegato ad altri consulenti — il sistema lo indica con un badge "Multi-profilo". Questo non è un problema ma un'opportunità: significa che il cliente è già abituato a usare la piattaforma e probabilmente è un cliente più "facile" da gestire.

La privacy è totale: tu non vedi nulla di ciò che il cliente fa con l'altro consulente, e viceversa. Ogni consulente ha accesso solo al suo contesto — conversazioni, esercizi, appuntamenti, note.

Questo sistema multi-profilo è anche alla base del modello di crescita: se fai un buon lavoro, i tuoi clienti parleranno della piattaforma ad altri professionisti, che si iscriveranno come consulenti. Il tuo cliente diventa il ponte tra te e nuovi consulenti sulla piattaforma — e tutti beneficiano dall'ecosistema.

Con questa lezione, hai completato tutte e trenta le lezioni dell'Accademia. Complimenti — adesso conosci ogni angolo della piattaforma e sei pronto per sfruttarla al massimo.
