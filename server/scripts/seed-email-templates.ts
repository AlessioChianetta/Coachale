// Script to seed email journey templates (28 days)
import { storage } from "../storage";

const templates = [
  // Settimana 1 (giorni 1-7)
  {
    dayOfMonth: 1,
    title: "Benvenuto nel Nuovo Mese",
    description: "Email di apertura mese con recap mese scorso e obiettivi per il nuovo mese",
    emailType: "recap_obiettivi",
    tone: "motivazionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email motivazionale per il primo giorno del mese. 
    
STRUTTURA:
1. Saluto caloroso e benvenuto nel nuovo mese
2. Recap veloce del mese scorso (usa dati da momentum, esercizi completati, consulenze)
3. Celebra i successi del mese precedente
4. Presenta i focus per questo nuovo mese
5. Suggerisci 2-3 azioni concrete per iniziare bene

DATI DISPONIBILI: Momentum check-in, esercizi, consulenze, obiettivi attivi, calendario

VERIFICA AZIONI PRECEDENTI: Controlla se nell'ultima email del mese scorso erano state suggerite azioni. Se sì, verifica se sono state completate e commentale.`
  },
  {
    dayOfMonth: 2,
    title: "Check Esercizi Pending",
    description: "Primo sollecito gentile per esercizi non completati",
    emailType: "esercizi",
    tone: "amichevole" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email amichevole per sollecitare esercizi pending.

STRUTTURA:
1. Saluto cordiale
2. Elenca esercizi pending (max 3-4) con scadenze
3. Per ogni esercizio, spiega brevemente perché è importante
4. Suggerisci di dedicare tempo oggi per almeno 1 esercizio
5. Offri supporto se c'è qualche difficoltà

DATI DISPONIBILI: Lista esercizi pending con scadenze, difficulty rating

VERIFICA AZIONI PRECEDENTI: Se l'email precedente chiedeva di completare esercizi specifici, verifica se sono stati completati. Se sì, complimenta. Se no, chiedi gentilmente se c'è qualche blocco.`
  },
  {
    dayOfMonth: 3,
    title: "Corso Consigliato",
    description: "Suggerimento corso basato su gap di conoscenza del cliente",
    emailType: "corsi",
    tone: "professionale" as const,
    priority: 6,
    promptTemplate: `Scrivi un'email professionale per suggerire un corso dall'università.

STRUTTURA:
1. Analizza i corsi/lezioni non completati
2. Suggerisci 1-2 corsi specifici che colmano gap di conoscenza
3. Spiega come questi corsi si collegano ai suoi obiettivi
4. Suggerisci di dedicare 30-45 minuti questa settimana
5. Evidenzia il beneficio pratico

DATI DISPONIBILI: Università (anni, trimestri, moduli, lezioni, progress), obiettivi

VERIFICA AZIONI PRECEDENTI: Se l'email precedente suggeriva di vedere lezioni specifiche, verifica se sono state viste.`
  },
  {
    dayOfMonth: 4,
    title: "Momentum Check-in",
    description: "Verifica come sta andando il mese a livello di energia e produttività",
    emailType: "momentum",
    tone: "amichevole" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email per fare un check-in sul momentum del cliente.

STRUTTURA:
1. Saluto e intro breve
2. Analizza i check-in momentum recenti (mood, energia, produttività)
3. Identifica pattern positivi o negativi
4. Se energia bassa, suggerisci azioni per ricaricare
5. Se streak alto, celebralo!
6. Chiedi come sta andando e se ha bisogno di supporto

DATI DISPONIBILI: Momentum check-ins (ultimi 7-14 giorni), streak, obiettivi momentum

VERIFICA AZIONI PRECEDENTI: Controlla se nell'email precedente erano stati suggeriti check-in giornalieri o riflessi quotidiane. Se sì, verifica se sono stati fatti.`
  },
  {
    dayOfMonth: 5,
    title: "Urgenza Esercizi in Scadenza",
    description: "Alert per esercizi che scadono nei prossimi 3-5 giorni",
    emailType: "urgenza",
    tone: "professionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email urgente ma professionale per esercizi in scadenza imminente.

STRUTTURA:
1. Alert chiaro e diretto
2. Lista esercizi in scadenza nei prossimi 3-5 giorni (ordinati per scadenza)
3. Per ognuno, indica quanti giorni mancano
4. Suggerisci priorità e ordine di completamento
5. Offri supporto per eventuali difficoltà

DATI DISPONIBILI: Esercizi pending con scadenze

TONO: Urgente ma incoraggiante, non ansioso

VERIFICA AZIONI PRECEDENTI: Se nell'email precedente erano menzionati questi esercizi, commenta che sono ancora pending.`
  },
  {
    dayOfMonth: 6,
    title: "Follow-up Consulenza",
    description: "Ricapitola azioni concordate nell'ultima consulenza e verifica progressi",
    emailType: "follow_up",
    tone: "professionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email di follow-up dopo l'ultima consulenza.

STRUTTURA:
1. Riferimento alla consulenza (data)
2. Ricapitola 3-4 punti chiave discussi (usa trascrizione se disponibile)
3. Lista azioni concordate (consultation tasks)
4. Per ogni azione, verifica se è stata completata
5. Suggerisci next steps per azioni non completate
6. Anticipa prossima consulenza se programmata

DATI DISPONIBILI: Ultime consulenze con trascrizioni Fathom, consultation tasks

VERIFICA AZIONI PRECEDENTI: Controlla le consultation tasks e verifica quali sono state completate. Celebra quelle completate, sollecita gentilmente quelle pending.`
  },
  {
    dayOfMonth: 7,
    title: "Recap Settimanale",
    description: "Riassunto prima settimana del mese con progressi e prossimi passi",
    emailType: "recap",
    tone: "motivazionale" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email di recap della prima settimana del mese.

STRUTTURA:
1. Saluto e intro positiva
2. Highlights della settimana: esercizi completati, lezioni viste, check-in momentum
3. Celebra successi anche piccoli
4. Identifica 1-2 aree dove serve più focus
5. Obiettivi per la prossima settimana (3 azioni concrete)
6. Incoraggiamento finale

DATI DISPONIBILI: Tutti i dati (esercizi, università, momentum, consulenze ultimi 7 giorni)

VERIFICA AZIONI PRECEDENTI: Fai un recap di tutte le azioni suggerite negli ultimi 7 giorni e verifica quali sono state completate.`
  },

  // Settimana 2 (giorni 8-14)
  {
    dayOfMonth: 8,
    title: "Motivazione Mid-Week",
    description: "Boost motivazionale a metà della seconda settimana",
    emailType: "motivazione",
    tone: "motivazionale" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email motivazionale per metà settimana.

STRUTTURA:
1. Saluto energico
2. Ricorda perché ha iniziato questo percorso (usa stato attuale vs ideale)
3. Evidenzia progressi concreti fatti finora
4. Suggerisci 1 azione di impatto oggi
5. Chiusura con affermazione positiva

DATI DISPONIBILI: Stato cliente (current state, ideal state, benefici), progressi recenti

TONO: Energico, positivo, incoraggiante`
  },
  {
    dayOfMonth: 9,
    title: "Check Progresso Università",
    description: "Verifica avanzamento nei moduli e lezioni universitarie",
    emailType: "corsi",
    tone: "professionale" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email per verificare il progresso nell'università.

STRUTTURA:
1. Analizza il progresso nei vari anni/trimestri/moduli
2. Identifica moduli iniziati ma non completati
3. Suggerisci di completare 1-2 lezioni questa settimana
4. Evidenzia come le lezioni si collegano ai suoi obiettivi
5. Incoraggia costanza

DATI DISPONIBILI: Università (progress per anno/trimestre/modulo/lezione), obiettivi

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano lezioni specifiche, verifica se sono state completate.`
  },
  {
    dayOfMonth: 10,
    title: "Celebrazione Progressi",
    description: "Email di celebrazione per progressi e milestone raggiunti",
    emailType: "celebrazione",
    tone: "motivazionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email di celebrazione per i progressi del cliente.

STRUTTURA:
1. Intro celebrativa
2. Lista progressi concreti (esercizi completati, lezioni viste, streak momentum, obiettivi)
3. Confronta con inizio mese o settimane precedenti
4. Celebra anche piccole vittorie
5. Incoraggia a continuare così
6. Suggerisci premio/pausa meritata

DATI DISPONIBILI: Tutti i dati, confronta con periodi precedenti

TONO: Celebrativo, entusiasta, orgoglioso

VERIFICA AZIONI PRECEDENTI: Non necessaria per questa email, focus su celebrazione.`
  },
  {
    dayOfMonth: 11,
    title: "Check Libreria Documenti",
    description: "Suggerimento documenti dalla libreria utili per obiettivi del cliente",
    emailType: "libreria",
    tone: "professionale" as const,
    priority: 6,
    promptTemplate: `Scrivi un'email per suggerire documenti dalla libreria.

STRUTTURA:
1. Analizza documenti assegnati ma non letti
2. Suggerisci 1-2 documenti specifici rilevanti per i suoi obiettivi
3. Spiega come questi documenti possono aiutarlo
4. Suggerisci di dedicare 15-20 minuti per leggerli
5. Evidenzia beneficio pratico immediato

DATI DISPONIBILI: Libreria (categorie, documenti, progress), obiettivi

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano documenti specifici, verifica se sono stati letti.`
  },
  {
    dayOfMonth: 12,
    title: "Suggerimento Pratico",
    description: "Email con un suggerimento pratico e actionable per il cliente",
    emailType: "suggerimento",
    tone: "amichevole" as const,
    priority: 6,
    promptTemplate: `Scrivi un'email con un suggerimento pratico basato sui suoi dati.

STRUTTURA:
1. Analizza i suoi dati (esercizi, università, momentum, obiettivi)
2. Identifica 1 area dove un suggerimento pratico può fare differenza
3. Fornisci il suggerimento con spiegazione chiara
4. Azione concreta da fare oggi o questa settimana
5. Beneficio atteso

DATI DISPONIBILI: Tutti i dati

ESEMPI SUGGERIMENTI: Tecnica Pomodoro per produttività, time blocking per esercizi, review serale, etc.

VERIFICA AZIONI PRECEDENTI: Se suggerimenti precedenti, verifica se applicati.`
  },
  {
    dayOfMonth: 13,
    title: "Check Obiettivi Roadmap",
    description: "Verifica progresso nei roadmap items e obiettivi a lungo termine",
    emailType: "roadmap",
    tone: "professionale" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email per verificare il progresso nella roadmap ORBITALE.

STRUTTURA:
1. Analizza progresso nelle fasi della roadmap
2. Identifica items completati recentemente (celebra!)
3. Evidenzia items in corso
4. Suggerisci 1-2 items da completare questa settimana
5. Collega alla visione a lungo termine

DATI DISPONIBILI: Roadmap (fasi, gruppi, items, progress con note e voti)

VERIFICA AZIONI PRECEDENTI: Se email precedenti menzionavano roadmap items specifici, verifica completamento.`
  },
  {
    dayOfMonth: 14,
    title: "Recap Metà Mese",
    description: "Riassunto completo prima metà mese con analisi e obiettivi seconda metà",
    emailType: "recap",
    tone: "professionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email di recap dettagliato della prima metà del mese.

STRUTTURA:
1. Intro: siamo a metà mese
2. Analisi completa prima metà:
   - Esercizi: quanti completati vs assegnati
   - Università: lezioni viste, moduli progrediti
   - Momentum: streak, energia, produttività
   - Consulenze: insights chiave
   - Roadmap: items completati
3. Celebra successi
4. Identifica 2-3 aree di miglioramento
5. Piano per seconda metà: 3-5 obiettivi concreti
6. Motivazione per sprint finale

DATI DISPONIBILI: Tutti i dati degli ultimi 14 giorni

VERIFICA AZIONI PRECEDENTI: Recap completo di tutte le azioni suggerite nei 14 giorni precedenti.`
  },

  // Settimana 3 (giorni 15-21)
  {
    dayOfMonth: 15,
    title: "Nuovo Focus - Seconda Metà",
    description: "Email per iniziare la seconda metà del mese con focus e energia rinnovata",
    emailType: "motivazione",
    tone: "motivazionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email motivazionale per iniziare la seconda metà del mese.

STRUTTURA:
1. Reset positivo: seconda metà = nuova opportunità
2. Riconferma obiettivi principali del mese
3. Identifica 1-2 focus chiave per i prossimi 14 giorni
4. Azione immediata da fare oggi
5. Incoraggiamento energico

DATI DISPONIBILI: Obiettivi attivi, stato cliente

TONO: Energico, rinnovato, determinato`
  },
  {
    dayOfMonth: 16,
    title: "Check Esercizi Nuovi",
    description: "Sollecito per esercizi assegnati recentemente",
    emailType: "esercizi",
    tone: "amichevole" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email per sollecitare esercizi assegnati recentemente.

STRUTTURA:
1. Saluto
2. Evidenzia esercizi assegnati negli ultimi 7-10 giorni
3. Per ognuno, spiega rilevanza
4. Suggerisci di iniziarne almeno 1 oggi
5. Ricorda che hai supporto disponibile

DATI DISPONIBILI: Esercizi con data assegnazione

VERIFICA AZIONI PRECEDENTI: Verifica se esercizi menzionati in email precedenti sono stati iniziati o completati.`
  },
  {
    dayOfMonth: 17,
    title: "Momentum Energia",
    description: "Email focalizzata su energia e benessere personale",
    emailType: "momentum",
    tone: "amichevole" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email focalizzata su energia e benessere.

STRUTTURA:
1. Analizza i check-in momentum recenti (energia, mood)
2. Se energia bassa: suggerisci azioni per ricaricare (pausa, sport, natura, etc.)
3. Se energia alta: complimenta e incoraggia a sfruttarla per tasks importanti
4. Ricorda importanza di equilibrio lavoro-riposo
5. Suggerisci 1 azione concreta per il benessere oggi

DATI DISPONIBILI: Momentum check-ins (energia, mood, note)

TONO: Caloroso, supportivo, attento al benessere

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano azioni per benessere, verifica se fatte.`
  },
  {
    dayOfMonth: 18,
    title: "Follow-up Azioni Precedenti",
    description: "Email dedicata a verificare completamento azioni dalle email precedenti",
    emailType: "follow_up",
    tone: "professionale" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email di follow-up dedicata alle azioni precedenti.

STRUTTURA:
1. Intro: follow-up delle azioni suggerite nelle ultime 2 settimane
2. Per ogni azione importante suggerita:
   - Ricorda l'azione
   - Verifica se completata
   - Se sì: complimenta e chiedi risultati
   - Se no: chiedi gentilmente cosa blocca
3. Suggerisci priorità per azioni non completate
4. Offri supporto per sbloccarle

DATI DISPONIBILI: Tutti i dati per verificare completamento

VERIFICA AZIONI PRECEDENTI: Questo è il focus principale di questa email - verifica TUTTE le azioni suggerite nelle ultime 2 settimane.`
  },
  {
    dayOfMonth: 19,
    title: "Check Finanziario",
    description: "Email su gestione finanziaria se il cliente usa Software Orbitale",
    emailType: "finanza",
    tone: "professionale" as const,
    priority: 6,
    promptTemplate: `Scrivi un'email sui dati finanziari del Software Orbitale.

STRUTTURA:
1. SE il cliente usa Software Orbitale:
   - Analizza dati finanziari (budget, spese, entrate, investimenti)
   - Evidenzia insights interessanti (trend, budget superati, risparmi)
   - Suggerisci 1-2 azioni per migliorare situazione finanziaria
   - Collega alla visione a lungo termine (futureVision)
2. SE il cliente NON usa Software Orbitale:
   - Salta questa email o sostituisci con suggerimento per altro obiettivo

DATI DISPONIBILI: Finance data (solo se disponibile), obiettivi

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano azioni finanziarie, verifica.`
  },
  {
    dayOfMonth: 20,
    title: "Motivazione Persistenza",
    description: "Email motivazionale sulla persistenza e costanza",
    emailType: "motivazione",
    tone: "motivazionale" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email motivazionale sulla persistenza.

STRUTTURA:
1. Tema: importanza della costanza e persistenza
2. Evidenzia il suo streak e la costanza dimostrata finora
3. Celebra piccoli passi quotidiani
4. Ricorda che i grandi risultati vengono da azioni piccole ripetute
5. Incoraggia a continuare, anche quando difficile
6. Azione: 1 piccola cosa da fare oggi per mantenere momentum

DATI DISPONIBILI: Momentum streak, progressi nel tempo

TONO: Ispirazionale, incoraggiante, supportivo`
  },
  {
    dayOfMonth: 21,
    title: "Sprint Finale Inizia",
    description: "Email per iniziare lo sprint finale - si adatta alla lunghezza del mese",
    emailType: "urgenza",
    tone: "motivazionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email per iniziare lo sprint finale del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Il giorno 21 cade in momenti diversi a seconda della lunghezza del mese:
- In un mese di 28 giorni: siamo al giorno 21, mancano 7 giorni (ultima settimana!)
- In un mese di 30 giorni: siamo al giorno 21, mancano 9 giorni
- In un mese di 31 giorni: siamo al giorno 21, mancano 10 giorni

ADATTA IL MESSAGGIO: non dire "ultima settimana" se mancano più di 8 giorni.

STRUTTURA:
1. Annuncio: entramo nella fase finale del mese (specifica quanti giorni mancano)
2. Recap veloce di cosa è stato fatto finora (primi 20 giorni)
3. Identifica 3-5 priorità chiave per chiudere bene il mese:
   - Esercizi pending con scadenza fine mese
   - Obiettivi da completare
   - Roadmap items in corso
4. Piano d'azione per i giorni rimanenti
5. Motivazione finale: chiudi forte!

DATI DISPONIBILI: Tutti i dati, focus su pending items con scadenze

TONO: Energico, focalizzato, determinato

VERIFICA AZIONI PRECEDENTI: Verifica azioni importanti del mese ancora pending.`
  },

  // Settimana 4 (giorni 22-28)
  {
    dayOfMonth: 22,
    title: "Check Tutto Pending",
    description: "Email completa con tutti gli items pending - si adatta alla lunghezza del mese",
    emailType: "urgenza",
    tone: "professionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email completa con tutti gli items pending.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 22, i giorni rimanenti variano:
- In un mese di 28 giorni: mancano 6 giorni
- In un mese di 30 giorni: mancano 8 giorni
- In un mese di 31 giorni: mancano 9 giorni

ADATTA IL MESSAGGIO: specifica il numero corretto di giorni rimanenti.

STRUTTURA:
1. Intro: specifica quanti giorni mancano alla fine del mese
2. Lista completa e organizzata di tutto ciò che è pending:
   - Esercizi (ordinati per scadenza)
   - Consultation tasks
   - Obiettivi in corso
   - Roadmap items iniziati ma non completati
   - Lezioni università non finite
3. Per ognuno, indica priorità (alta/media/bassa)
4. Suggerisci piano per completare priorità alte nei giorni rimanenti
5. Incoraggia focus e determinazione

DATI DISPONIBILI: Tutti i dati pending

VERIFICA AZIONI PRECEDENTI: Lista di tutte le azioni suggerite nel mese non ancora completate.`
  },
  {
    dayOfMonth: 23,
    title: "Urgenza Finale",
    description: "Email urgente per items critici - si adatta alla lunghezza del mese",
    emailType: "urgenza",
    tone: "professionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email urgente per items critici da completare.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 23, i giorni rimanenti variano:
- In un mese di 28 giorni: mancano 5 giorni
- In un mese di 30 giorni: mancano 7 giorni
- In un mese di 31 giorni: mancano 8 giorni

ADATTA IL MESSAGGIO: specifica il numero corretto di giorni rimanenti e adapta l'urgenza.

STRUTTURA:
1. Alert: specifica quanti giorni mancano alla fine del mese
2. Focus solo su items CRITICI:
   - Esercizi con scadenza entro fine mese
   - Tasks con alta priorità
   - Obiettivi con target date fine mese
3. Per ognuno, indica deadline esatta
4. Suggerisci ordine di completamento
5. Offri supporto urgente se serve
6. Motivazione: ce la puoi fare!

DATI DISPONIBILI: Esercizi e tasks con scadenze imminenti

TONO: Urgente ma supportivo, non ansioso (adatta l'intensità ai giorni rimanenti)

VERIFICA AZIONI PRECEDENTI: Focus su azioni critiche non completate.`
  },
  {
    dayOfMonth: 24,
    title: "Celebrazione Streak",
    description: "Email per celebrare lo streak e la costanza del cliente",
    emailType: "celebrazione",
    tone: "motivazionale" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email per celebrare lo streak del cliente.

STRUTTURA:
1. Celebra lo streak corrente (giorni consecutivi)
2. Evidenzia l'impatto della costanza
3. Confronta con inizio mese o mesi precedenti
4. Incoraggia a mantenere lo streak fino a fine mese (e oltre!)
5. Ricorda che ogni giorno conta
6. Azione: check-in oggi per mantenere streak

DATI DISPONIBILI: Momentum streak, check-ins nel tempo

TONO: Celebrativo, fiero, incoraggiante

VERIFICA AZIONI PRECEDENTI: Non necessaria, focus su celebrazione streak.`
  },
  {
    dayOfMonth: 25,
    title: "Preparazione Prossimo Mese",
    description: "Email per iniziare a pensare agli obiettivi del prossimo mese - dinamica",
    emailType: "pianificazione",
    tone: "professionale" as const,
    priority: 7,
    promptTemplate: `Scrivi un'email per preparare il prossimo mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 25, i giorni rimanenti variano:
- In un mese di 28 giorni: mancano 3 giorni (fase conclusiva!)
- In un mese di 30 giorni: mancano 5 giorni
- In un mese di 31 giorni: mancano 6 giorni

ADATTA IL MESSAGGIO: 
- Se mancano 3-4 giorni: focus su chiusura E pianificazione
- Se mancano 5+ giorni: più enfasi su completamento prima della pianificazione

STRUTTURA:
1. Intro: specifica quanti giorni mancano e bilancia chiusura/pianificazione
2. Invita a riflettere su:
   - Cosa ha funzionato bene questo mese
   - Cosa migliorare
   - Nuovi obiettivi per prossimo mese
3. Suggerisci di dedicare 15-20 minuti a pianificare
4. Anticipa che riceverà supporto per pianificazione
5. Focus: chiudi forte questo mese E preparati per il prossimo

DATI DISPONIBILI: Progressi del mese corrente, obiettivi

TONO: Riflessivo ma proattivo

VERIFICA AZIONI PRECEDENTI: Verifica se azioni del mese sono quasi tutte completate.`
  },
  {
    dayOfMonth: 26,
    title: "Recap Consulenze Mese",
    description: "Riassunto di tutte le consulenze del mese con insights chiave",
    emailType: "follow_up",
    tone: "professionale" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email di recap delle consulenze del mese.

STRUTTURA:
1. Lista tutte le consulenze del mese (date)
2. Per ogni consulenza:
   - Tema principale discusso
   - Insights chiave (usa trascrizioni se disponibili)
   - Azioni concordate e status
3. Identifica temi ricorrenti o pattern
4. Evidenzia progressi fatti grazie alle consulenze
5. Anticipa focus per prossime consulenze

DATI DISPONIBILI: Consulenze del mese con trascrizioni, consultation tasks

VERIFICA AZIONI PRECEDENTI: Verifica completion di tutte le consultation tasks del mese.`
  },
  {
    dayOfMonth: 27,
    title: "Verifica Obiettivi Raggiunti",
    description: "Email per verificare obiettivi raggiunti - si adatta alla lunghezza del mese",
    emailType: "obiettivi",
    tone: "motivazionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email per verificare obiettivi raggiunti.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Al giorno 27, i giorni rimanenti variano:
- In un mese di 28 giorni: manca 1 giorno (ultimo giorno!)
- In un mese di 30 giorni: mancano 3 giorni
- In un mese di 31 giorni: mancano 4 giorni

ADATTA IL MESSAGGIO: specifica correttamente quanti giorni mancano e l'urgenza.

STRUTTURA:
1. Intro: specifica quanti giorni mancano e il momento di verifica obiettivi
2. Per ogni obiettivo attivo:
   - Target value vs current value
   - Progress % 
   - Se raggiunto: CELEBRA! 🎉
   - Se quasi raggiunto: incoraggia sprint finale (se ci sono giorni rimanenti)
   - Se lontano: analizza cosa è mancato (senza giudizio)
3. Celebra anche progressi parziali
4. Se mancano giorni: opportunità per ultimo push
5. Incoraggiamento finale

DATI DISPONIBILI: Obiettivi con target e current values

VERIFICA AZIONI PRECEDENTI: Verifica se azioni suggerite nel mese hanno contribuito a obiettivi.`
  },
  {
    dayOfMonth: 28,
    title: "Sprint Finale Settimana",
    description: "Email per spinta finale ultimi 4 giorni - si adatta alla lunghezza del mese",
    emailType: "sprint_finale",
    tone: "motivazionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email motivazionale per la settimana finale del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Questo template viene usato quando mancano 4 giorni alla fine del mese.
- In un mese di 28 giorni: siamo al giorno 25 (4 giorni alla fine)
- In un mese di 30 giorni: siamo al giorno 27 (4 giorni alla fine)
- In un mese di 31 giorni: siamo al giorno 28 (4 giorni alla fine)

ADATTA IL MESSAGGIO in base al contesto: se siamo in un mese lungo, NON parlare di "fine mese" ma di "settimana finale sprint".

STRUTTURA:
1. INTRO: Sprint finale! Ultimi giorni per dare il meglio
2. QUICK RECAP: Dove siamo adesso nel percorso
   - Esercizi completati questo mese
   - Lezioni viste
   - Consulenze fatte
   - Momentum generale

3. FOCUS ULTIMI GIORNI:
   - Esercizi ancora da completare (urgent push)
   - Obiettivi che possono essere raggiunti
   - Quick wins possibili nei prossimi giorni

4. MOTIVAZIONE:
   - Celebra i progressi fatti finora
   - Energia positiva per sprint finale
   - Ogni giorno conta!

5. CALL TO ACTION:
   - 2-3 azioni concrete per i prossimi giorni
   - Focus su completamento vs nuovo inizio

TONO: Energico, motivazionale, focus su sprint finale

VERIFICA AZIONI PRECEDENTI: Controlla azioni email precedente e motiva al completamento.`
  },

  // Template Extra per mesi di 29-31 giorni
  {
    dayOfMonth: 29,
    title: "Spinta Finale 3 Giorni",
    description: "Email per penultimi 3 giorni del mese - si adatta alla lunghezza",
    emailType: "push_finale",
    tone: "motivazionale" as const,
    priority: 8,
    promptTemplate: `Scrivi un'email motivazionale per gli ultimi 3 giorni del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Questo template viene usato quando mancano 3 giorni alla fine del mese.
- In un mese di 28 giorni: siamo al giorno 26 (3 giorni alla fine)
- In un mese di 29 giorni: siamo al giorno 27 (3 giorni alla fine) 
- In un mese di 30 giorni: siamo al giorno 28 (3 giorni alla fine)
- In un mese di 31 giorni: siamo al giorno 29 (3 giorni alla fine)

ADATTA IL MESSAGGIO: se il mese ha 31 giorni, NON dire "quasi finito" ma "ultimi giorni importanti".

STRUTTURA:
1. URGENZA POSITIVA: Ultimi giorni per chiudere in bellezza!
2. PRIORITÀ MASSIMA:
   - Esercizi in scadenza (urgenti!)
   - Obiettivi vicini al traguardo
   - Task critiche da completare

3. QUICK WINS:
   - Cosa può essere completato OGGI
   - Cosa può essere fatto domani
   - Cosa lasciare per dopo

4. SUPPORT OFFER:
   - Se c'è qualche blocco, ora è il momento di risolverlo
   - Disponibilità per supporto urgente

5. MOTIVAZIONE:
   - Focus sugli ultimi giorni
   - Energia per chiusura forte

TONO: Urgente ma positivo, energico, supportivo

VERIFICA AZIONI PRECEDENTI: Check azioni precedenti e prioritizza pending urgenti.`
  },
  {
    dayOfMonth: 30,
    title: "Preparazione Chiusura Mese",
    description: "Email per penultimo giorno del mese - preparazione alla chiusura",
    emailType: "preparazione_chiusura",
    tone: "professionale" as const,
    priority: 9,
    promptTemplate: `Scrivi un'email di preparazione alla chiusura del mese.

⚠️ CONTESTO DINAMICO - IMPORTANTE:
Questo template viene usato quando mancano 2 giorni alla fine del mese.
- In un mese di 28 giorni: siamo al giorno 27 (2 giorni alla fine)
- In un mese di 29 giorni: siamo al giorno 28 (2 giorni alla fine)
- In un mese di 30 giorni: siamo al giorno 29 (2 giorni alla fine)
- In un mese di 31 giorni: siamo al giorno 30 (2 giorni alla fine)

ADATTA IL MESSAGGIO: specifica quanti giorni mancano alla fine (1-2 giorni).

STRUTTURA:
1. COUNTDOWN: Penultimo/ultimo momento per chiudere items importanti
2. CHECK FINALE:
   - Esercizi pending: quali possono essere completati oggi/domani
   - Obiettivi: verifica progress finale
   - Tasks: prioritizza ultimi completamenti

3. PREPARAZIONE CHIUSURA:
   - Recap veloce del mese
   - Celebra progressi fatti
   - Identifica 2-3 completamenti chiave ancora possibili

4. MINDSET TRANSIZIONE:
   - Se domani è l'ultimo giorno: prepara per chiusura
   - Se c'è ancora un giorno dopo: focus su sprint finale

5. SUPPORTO:
   - Disponibilità per call last-minute se necessario
   - Incoraggiamento finale

TONO: Professionale, supportivo, focus su chiusura positiva

VERIFICA AZIONI PRECEDENTI: Check finale azioni mese, celebra completamenti.`
  },
  {
    dayOfMonth: 31,
    title: "Chiusura Mese - Recap e Celebrazione",
    description: "Email di chiusura definitiva del mese con recap completo",
    emailType: "chiusura_mese",
    tone: "motivazionale" as const,
    priority: 10,
    promptTemplate: `Scrivi un'email di chiusura completa del mese con recap e celebrazione.

⚠️ QUESTO È L'ULTIMO GIORNO DEL MESE!

Questo template viene usato nell'ultimo giorno del mese (che può essere 28, 29, 30 o 31).
Domani inizia un nuovo ciclo da giorno 1.

STRUTTURA COMPLETA:

1. CELEBRAZIONE APERTURA:
   - Ultimo giorno del mese! Tempo di bilanci
   - Celebra il percorso fatto insieme
   - Riconosci l'impegno e la costanza

2. RECAP COMPLETO DEL MESE:
   - **Esercizi**: Completati vs assegnati, highlights principali
   - **Università**: Lezioni viste, moduli completati, progressi
   - **Momentum**: Streak finale, media energia/mood del mese
   - **Consulenze**: Numero e insights chiave discussi
   - **Obiettivi**: Raggiunti, in corso, nuovi creati
   - **Libreria**: Documenti consultati
   - **Roadmap**: Items completati, avanzamenti fasi

3. CELEBRAZIONI E SUCCESSI:
   - Lista TUTTI i successi del mese (specifici!)
   - Celebra crescita personale e professionale
   - Evidenzia breakthrough moments

4. ANALISI COSTRUTTIVA:
   - Cosa ha funzionato particolarmente bene
   - Pattern di successo identificati
   - Aree di miglioramento per prossimo mese (senza giudizio)

5. ANTICIPAZIONE NUOVO CICLO:
   - Domani inizia un nuovo ciclo di 28+ giorni!
   - Nuovi focus e obiettivi per il mese che arriva
   - Motivazione ed entusiasmo per ricominciare
   - Continuità del percorso di crescita

6. CHIUSURA EMOZIONALE:
   - Orgoglio per il lavoro fatto questo mese
   - Gratitudine per la fiducia e l'impegno
   - Entusiasmo per ciò che verrà
   - Disponibilità e supporto continuo

DATI DISPONIBILI: TUTTI i dati del mese completo (fino a 31 giorni)

TONO: Celebrativo, riflessivo, emozionale, motivazionale, professionale

IMPORTANTE: 
- NON menzionare "28 giorni" - il mese può essere di qualsiasi lunghezza
- Parla di "questo mese" o "il mese che si chiude"
- Domani inizia SEMPRE il giorno 1 del nuovo ciclo

VERIFICA AZIONI PRECEDENTI: Recap finale di TUTTE le azioni suggerite nel mese intero.`
  }
];

async function seedEmailTemplates() {
  try {
    console.log("🌱 Starting email journey templates seeding...\n");

    // Check if templates already exist
    const existing = await storage.getAllEmailJourneyTemplates();
    
    if (existing.length > 0) {
      console.log(`⚠️  Found ${existing.length} existing templates in database.`);
      console.log("Do you want to:");
      console.log("1. Skip seeding (templates already exist)");
      console.log("2. Delete existing and recreate");
      console.log("\nFor safety, this script will skip seeding.");
      console.log("If you want to recreate, manually delete templates first.\n");
      return;
    }

    console.log("✓ No existing templates found. Proceeding with seeding...\n");

    // Create all 31 templates (28 standard + 3 extra for longer months)
    let created = 0;
    for (const template of templates) {
      try {
        await storage.createEmailJourneyTemplate(template);
        created++;
        console.log(`✓ Created template for day ${template.dayOfMonth}: "${template.title}"`);
      } catch (error: any) {
        console.error(`✗ Failed to create template for day ${template.dayOfMonth}:`, error.message);
      }
    }

    console.log(`\n🎉 Seeding completed! Created ${created}/${templates.length} templates.`);

    // Verify
    const all = await storage.getAllEmailJourneyTemplates();
    console.log(`\n📊 Verification: ${all.length} templates now in database.`);
    
    if (all.length === 31) {
      console.log("✅ SUCCESS: All 31 templates created successfully!");
      console.log("   - Days 1-28: Standard monthly cycle");
      console.log("   - Days 29-31: Extra templates for longer months");
    } else {
      console.log(`⚠️  WARNING: Expected 31 templates but found ${all.length}`);
    }

  } catch (error: any) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

// Run if called directly
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedEmailTemplates()
    .then(() => {
      console.log("\n✓ Script completed successfully");
      process.exit(0);
    })
    .catch((error) => {
      console.error("\n✗ Script failed:", error);
      process.exit(1);
    });
}

export { seedEmailTemplates };
