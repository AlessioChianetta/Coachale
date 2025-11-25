-- Script to update all 31 email journey templates with improved detailed prompts
-- Generated from seed-email-templates.ts

BEGIN;

-- Day 1
UPDATE email_journey_templates 
SET 
  title = 'Benvenuto nel Nuovo Mese',
  description = 'Email di apertura mese con recap mese scorso e obiettivi per il nuovo mese',
  email_type = 'recap_obiettivi',
  tone = 'motivazionale',
  priority = 10,
  prompt_template = 'Scrivi un''email motivazionale per il primo giorno del mese. 
    
STRUTTURA:
1. Saluto caloroso e benvenuto nel nuovo mese
2. Recap veloce del mese scorso (usa dati da momentum, esercizi completati, consulenze)
3. Celebra i successi del mese precedente
4. Presenta i focus per questo nuovo mese
5. Suggerisci 2-3 azioni concrete per iniziare bene

DATI DISPONIBILI: Momentum check-in, esercizi, consulenze, obiettivi attivi, calendario

VERIFICA AZIONI PRECEDENTI: Controlla se nell''ultima email del mese scorso erano state suggerite azioni. Se sì, verifica se sono state completate e commentale.',
  updated_at = NOW()
WHERE day_of_month = 1;

-- Day 2
UPDATE email_journey_templates 
SET 
  title = 'Check Esercizi Pending',
  description = 'Primo sollecito gentile per esercizi non completati',
  email_type = 'esercizi',
  tone = 'amichevole',
  priority = 7,
  prompt_template = 'Scrivi un''email amichevole per sollecitare esercizi pending.

STRUTTURA:
1. Saluto cordiale
2. Elenca esercizi pending (max 3-4) con scadenze
3. Per ogni esercizio, spiega brevemente perché è importante
4. Suggerisci di dedicare tempo oggi per almeno 1 esercizio
5. Offri supporto se c''è qualche difficoltà

DATI DISPONIBILI: Lista esercizi pending con scadenze, difficulty rating

VERIFICA AZIONI PRECEDENTI: Se l''email precedente chiedeva di completare esercizi specifici, verifica se sono stati completati. Se sì, complimenta. Se no, chiedi gentilmente se c''è qualche blocco.',
  updated_at = NOW()
WHERE day_of_month = 2;

-- Day 3
UPDATE email_journey_templates 
SET 
  title = 'Corso Consigliato',
  description = 'Suggerimento corso basato su gap di conoscenza del cliente',
  email_type = 'corsi',
  tone = 'professionale',
  priority = 6,
  prompt_template = 'Scrivi un''email professionale per suggerire un corso dall''università.

STRUTTURA:
1. Analizza i corsi/lezioni non completati
2. Suggerisci 1-2 corsi specifici che colmano gap di conoscenza
3. Spiega come questi corsi si collegano ai suoi obiettivi
4. Suggerisci di dedicare 30-45 minuti questa settimana
5. Evidenzia il beneficio pratico

DATI DISPONIBILI: Università (anni, trimestri, moduli, lezioni, progress), obiettivi

VERIFICA AZIONI PRECEDENTI: Se l''email precedente suggeriva di vedere lezioni specifiche, verifica se sono state viste.',
  updated_at = NOW()
WHERE day_of_month = 3;

-- Day 4
UPDATE email_journey_templates 
SET 
  title = 'Momentum Check-in',
  description = 'Verifica come sta andando il mese a livello di energia e produttività',
  email_type = 'momentum',
  tone = 'amichevole',
  priority = 8,
  prompt_template = 'Scrivi un''email per fare un check-in sul momentum del cliente.

STRUTTURA:
1. Saluto e intro breve
2. Analizza i check-in momentum recenti (mood, energia, produttività)
3. Identifica pattern positivi o negativi
4. Se energia bassa, suggerisci azioni per ricaricare
5. Se streak alto, celebralo!
6. Chiedi come sta andando e se ha bisogno di supporto

DATI DISPONIBILI: Momentum check-ins (ultimi 7-14 giorni), streak, obiettivi momentum

VERIFICA AZIONI PRECEDENTI: Controlla se nell''email precedente erano stati suggeriti check-in giornalieri o riflessi quotidiane. Se sì, verifica se sono stati fatti.',
  updated_at = NOW()
WHERE day_of_month = 4;

-- Day 5
UPDATE email_journey_templates 
SET 
  title = 'Urgenza Esercizi in Scadenza',
  description = 'Alert per esercizi che scadono nei prossimi 3-5 giorni',
  email_type = 'urgenza',
  tone = 'professionale',
  priority = 9,
  prompt_template = 'Scrivi un''email urgente ma professionale per esercizi in scadenza imminente.

STRUTTURA:
1. Alert chiaro e diretto
2. Lista esercizi in scadenza nei prossimi 3-5 giorni (ordinati per scadenza)
3. Per ognuno, indica quanti giorni mancano
4. Suggerisci priorità e ordine di completamento
5. Offri supporto per eventuali difficoltà

DATI DISPONIBILI: Esercizi pending con scadenze

TONO: Urgente ma incoraggiante, non ansioso

VERIFICA AZIONI PRECEDENTI: Se nell''email precedente erano menzionati questi esercizi, commenta che sono ancora pending.',
  updated_at = NOW()
WHERE day_of_month = 5;

-- Day 6
UPDATE email_journey_templates 
SET 
  title = 'Follow-up Consulenza',
  description = 'Ricapitola azioni concordate nell''ultima consulenza e verifica progressi',
  email_type = 'follow_up',
  tone = 'professionale',
  priority = 10,
  prompt_template = 'Scrivi un''email di follow-up dopo l''ultima consulenza.

STRUTTURA:
1. Riferimento alla consulenza (data)
2. Ricapitola 3-4 punti chiave discussi (usa trascrizione se disponibile)
3. Lista azioni concordate (consultation tasks)
4. Per ogni azione, verifica se è stata completata
5. Suggerisci next steps per azioni non completate
6. Anticipa prossima consulenza se programmata

DATI DISPONIBILI: Ultime consulenze con trascrizioni Fathom, consultation tasks

VERIFICA AZIONI PRECEDENTI: Controlla le consultation tasks e verifica quali sono state completate. Celebra quelle completate, sollecita gentilmente quelle pending.',
  updated_at = NOW()
WHERE day_of_month = 6;

-- Day 7
UPDATE email_journey_templates 
SET 
  title = 'Recap Settimanale',
  description = 'Riassunto prima settimana del mese con progressi e prossimi passi',
  email_type = 'recap',
  tone = 'motivazionale',
  priority = 8,
  prompt_template = 'Scrivi un''email di recap della prima settimana del mese.

STRUTTURA:
1. Saluto e intro positiva
2. Highlights della settimana: esercizi completati, lezioni viste, check-in momentum
3. Celebra successi anche piccoli
4. Identifica 1-2 aree dove serve più focus
5. Obiettivi per la prossima settimana (3 azioni concrete)
6. Incoraggiamento finale

DATI DISPONIBILI: Tutti i dati (esercizi, università, momentum, consulenze ultimi 7 giorni)

VERIFICA AZIONI PRECEDENTI: Fai un recap di tutte le azioni suggerite negli ultimi 7 giorni e verifica quali sono state completate.',
  updated_at = NOW()
WHERE day_of_month = 7;

-- Day 8
UPDATE email_journey_templates 
SET 
  title = 'Motivazione Mid-Week',
  description = 'Boost motivazionale a metà della seconda settimana',
  email_type = 'motivazione',
  tone = 'motivazionale',
  priority = 7,
  prompt_template = 'Scrivi un''email motivazionale per metà settimana.

STRUTTURA:
1. Saluto energico
2. Ricorda perché ha iniziato questo percorso (usa stato attuale vs ideale)
3. Evidenzia progressi concreti fatti finora
4. Suggerisci 1 azione di impatto oggi
5. Chiusura con affermazione positiva

DATI DISPONIBILI: Stato cliente (current state, ideal state, benefici), progressi recenti

TONO: Energico, positivo, incoraggiante',
  updated_at = NOW()
WHERE day_of_month = 8;

-- Day 9
UPDATE email_journey_templates 
SET 
  title = 'Check Progresso Università',
  description = 'Verifica avanzamento nei moduli e lezioni universitarie',
  email_type = 'corsi',
  tone = 'professionale',
  priority = 7,
  prompt_template = 'Scrivi un''email per verificare il progresso nell''università.

STRUTTURA:
1. Analizza il progresso nei vari anni/trimestri/moduli
2. Identifica moduli iniziati ma non completati
3. Suggerisci di completare 1-2 lezioni questa settimana
4. Evidenzia come le lezioni si collegano ai suoi obiettivi
5. Incoraggia costanza

DATI DISPONIBILI: Università (progress per anno/trimestre/modulo/lezione), obiettivi

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano lezioni specifiche, verifica se sono state completate.',
  updated_at = NOW()
WHERE day_of_month = 9;

-- Day 10
UPDATE email_journey_templates 
SET 
  title = 'Celebrazione Progressi',
  description = 'Email di celebrazione per progressi e milestone raggiunti',
  email_type = 'celebrazione',
  tone = 'motivazionale',
  priority = 9,
  prompt_template = 'Scrivi un''email di celebrazione per i progressi del cliente.

STRUTTURA:
1. Intro celebrativa
2. Lista progressi concreti (esercizi completati, lezioni viste, streak momentum, obiettivi)
3. Confronta con inizio mese o settimane precedenti
4. Celebra anche piccole vittorie
5. Incoraggia a continuare così
6. Suggerisci premio/pausa meritata

DATI DISPONIBILI: Tutti i dati, confronta con periodi precedenti

TONO: Celebrativo, entusiasta, orgoglioso

VERIFICA AZIONI PRECEDENTI: Non necessaria per questa email, focus su celebrazione.',
  updated_at = NOW()
WHERE day_of_month = 10;

-- Day 11
UPDATE email_journey_templates 
SET 
  title = 'Check Libreria Documenti',
  description = 'Suggerimento documenti dalla libreria utili per obiettivi del cliente',
  email_type = 'libreria',
  tone = 'professionale',
  priority = 6,
  prompt_template = 'Scrivi un''email per suggerire documenti dalla libreria.

STRUTTURA:
1. Analizza documenti assegnati ma non letti
2. Suggerisci 1-2 documenti specifici rilevanti per i suoi obiettivi
3. Spiega come questi documenti possono aiutarlo
4. Suggerisci di dedicare 15-20 minuti per leggerli
5. Evidenzia beneficio pratico immediato

DATI DISPONIBILI: Libreria (categorie, documenti, progress), obiettivi

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano documenti specifici, verifica se sono stati letti.',
  updated_at = NOW()
WHERE day_of_month = 11;

-- Day 12
UPDATE email_journey_templates 
SET 
  title = 'Suggerimento Pratico',
  description = 'Email con un suggerimento pratico e actionable per il cliente',
  email_type = 'suggerimento',
  tone = 'amichevole',
  priority = 6,
  prompt_template = 'Scrivi un''email con un suggerimento pratico basato sui suoi dati.

STRUTTURA:
1. Analizza i suoi dati (esercizi, università, momentum, obiettivi)
2. Identifica 1 area dove un suggerimento pratico può fare differenza
3. Fornisci il suggerimento con spiegazione chiara
4. Azione concreta da fare oggi o questa settimana
5. Beneficio atteso

DATI DISPONIBILI: Tutti i dati

ESEMPI SUGGERIMENTI: Tecnica Pomodoro per produttività, time blocking per esercizi, review serale, etc.

VERIFICA AZIONI PRECEDENTI: Se suggerimenti precedenti, verifica se applicati.',
  updated_at = NOW()
WHERE day_of_month = 12;

-- Day 13
UPDATE email_journey_templates 
SET 
  title = 'Check Obiettivi Roadmap',
  description = 'Verifica progresso nei roadmap items e obiettivi a lungo termine',
  email_type = 'roadmap',
  tone = 'professionale',
  priority = 7,
  prompt_template = 'Scrivi un''email per verificare il progresso nella roadmap ORBITALE.

STRUTTURA:
1. Analizza progresso nelle fasi della roadmap
2. Identifica items completati recentemente (celebra!)
3. Evidenzia items in corso
4. Suggerisci 1-2 items da completare questa settimana
5. Collega alla visione a lungo termine

DATI DISPONIBILI: Roadmap (fasi, gruppi, items, progress con note e voti)

VERIFICA AZIONI PRECEDENTI: Se email precedenti menzionavano roadmap items specifici, verifica completamento.',
  updated_at = NOW()
WHERE day_of_month = 13;

-- Day 14
UPDATE email_journey_templates 
SET 
  title = 'Recap Metà Mese',
  description = 'Riassunto completo prima metà mese con analisi e obiettivi seconda metà',
  email_type = 'recap',
  tone = 'professionale',
  priority = 10,
  prompt_template = 'Scrivi un''email di recap dettagliato della prima metà del mese.

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

VERIFICA AZIONI PRECEDENTI: Recap completo di tutte le azioni suggerite nei 14 giorni precedenti.',
  updated_at = NOW()
WHERE day_of_month = 14;

-- Day 15
UPDATE email_journey_templates 
SET 
  title = 'Nuovo Focus - Seconda Metà',
  description = 'Email per iniziare la seconda metà del mese con focus e energia rinnovata',
  email_type = 'motivazione',
  tone = 'motivazionale',
  priority = 9,
  prompt_template = 'Scrivi un''email motivazionale per iniziare la seconda metà del mese.

STRUTTURA:
1. Reset positivo: seconda metà = nuova opportunità
2. Riconferma obiettivi principali del mese
3. Identifica 1-2 focus chiave per i prossimi 14 giorni
4. Azione immediata da fare oggi
5. Incoraggiamento energico

DATI DISPONIBILI: Obiettivi attivi, stato cliente

TONO: Energico, rinnovato, determinato',
  updated_at = NOW()
WHERE day_of_month = 15;

-- Day 16
UPDATE email_journey_templates 
SET 
  title = 'Check Esercizi Nuovi',
  description = 'Sollecito per esercizi assegnati recentemente',
  email_type = 'esercizi',
  tone = 'amichevole',
  priority = 7,
  prompt_template = 'Scrivi un''email per sollecitare esercizi assegnati recentemente.

STRUTTURA:
1. Saluto
2. Evidenzia esercizi assegnati negli ultimi 7-10 giorni
3. Per ognuno, spiega rilevanza
4. Suggerisci di iniziarne almeno 1 oggi
5. Ricorda che hai supporto disponibile

DATI DISPONIBILI: Esercizi con data assegnazione

VERIFICA AZIONI PRECEDENTI: Verifica se esercizi menzionati in email precedenti sono stati iniziati o completati.',
  updated_at = NOW()
WHERE day_of_month = 16;

-- Day 17
UPDATE email_journey_templates 
SET 
  title = 'Momentum Energia',
  description = 'Email focalizzata su energia e benessere personale',
  email_type = 'momentum',
  tone = 'amichevole',
  priority = 7,
  prompt_template = 'Scrivi un''email focalizzata su energia e benessere.

STRUTTURA:
1. Analizza i check-in momentum recenti (energia, mood)
2. Se energia bassa: suggerisci azioni per ricaricare (pausa, sport, natura, etc.)
3. Se energia alta: complimenta e incoraggia a sfruttarla per tasks importanti
4. Ricorda importanza di equilibrio lavoro-riposo
5. Suggerisci 1 azione concreta per il benessere oggi

DATI DISPONIBILI: Momentum check-ins (energia, mood, note)

TONO: Caloroso, supportivo, attento al benessere

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano azioni per benessere, verifica se fatte.',
  updated_at = NOW()
WHERE day_of_month = 17;

-- Day 18
UPDATE email_journey_templates 
SET 
  title = 'Follow-up Azioni Precedenti',
  description = 'Email dedicata a verificare completamento azioni dalle email precedenti',
  email_type = 'follow_up',
  tone = 'professionale',
  priority = 8,
  prompt_template = 'Scrivi un''email di follow-up dedicata alle azioni precedenti.

STRUTTURA:
1. Intro: follow-up delle azioni suggerite nelle ultime 2 settimane
2. Per ogni azione importante suggerita:
   - Ricorda l''azione
   - Verifica se completata
   - Se sì: complimenta e chiedi risultati
   - Se no: chiedi gentilmente cosa blocca
3. Suggerisci priorità per azioni non completate
4. Offri supporto per sbloccarle

DATI DISPONIBILI: Tutti i dati per verificare completamento

VERIFICA AZIONI PRECEDENTI: Questo è il focus principale di questa email - verifica TUTTE le azioni suggerite nelle ultime 2 settimane.',
  updated_at = NOW()
WHERE day_of_month = 18;

-- Day 19
UPDATE email_journey_templates 
SET 
  title = 'Check Finanziario',
  description = 'Email su gestione finanziaria se il cliente usa Software Orbitale',
  email_type = 'finanza',
  tone = 'professionale',
  priority = 6,
  prompt_template = 'Scrivi un''email sui dati finanziari del Software Orbitale.

STRUTTURA:
1. SE il cliente usa Software Orbitale:
   - Analizza dati finanziari (budget, spese, entrate, investimenti)
   - Evidenzia insights interessanti (trend, budget superati, risparmi)
   - Suggerisci 1-2 azioni per migliorare situazione finanziaria
   - Collega alla visione a lungo termine (futureVision)
2. SE il cliente NON usa Software Orbitale:
   - Salta questa email o sostituisci con suggerimento per altro obiettivo

DATI DISPONIBILI: Finance data (solo se disponibile), obiettivi

VERIFICA AZIONI PRECEDENTI: Se email precedenti suggerivano azioni finanziarie, verifica.',
  updated_at = NOW()
WHERE day_of_month = 19;

-- Day 20
UPDATE email_journey_templates 
SET 
  title = 'Motivazione Persistenza',
  description = 'Email motivazionale sulla persistenza e costanza',
  email_type = 'motivazione',
  tone = 'motivazionale',
  priority = 7,
  prompt_template = 'Scrivi un''email motivazionale sulla persistenza.

STRUTTURA:
1. Tema: importanza della costanza e persistenza
2. Evidenzia il suo streak e la costanza dimostrata finora
3. Celebra piccoli passi quotidiani
4. Ricorda che i grandi risultati vengono da azioni piccole ripetute
5. Incoraggia a continuare, anche quando difficile
6. Azione: 1 piccola cosa da fare oggi per mantenere momentum

DATI DISPONIBILI: Momentum streak, progressi nel tempo

TONO: Ispirazionale, incoraggiante, supportivo',
  updated_at = NOW()
WHERE day_of_month = 20;

-- Day 21
UPDATE email_journey_templates 
SET 
  title = 'Sprint Finale Inizia',
  description = 'Email per iniziare lo sprint finale dell''ultima settimana',
  email_type = 'urgenza',
  tone = 'motivazionale',
  priority = 9,
  prompt_template = 'Scrivi un''email per iniziare lo sprint finale del mese.

STRUTTURA:
1. Annuncio: ultima settimana del mese!
2. Recap veloce di cosa è stato fatto finora
3. Identifica 3-5 priorità chiave per chiudere bene il mese:
   - Esercizi pending con scadenza fine mese
   - Obiettivi da completare
   - Roadmap items in corso
4. Piano d''azione per i prossimi 7 giorni
5. Motivazione finale: chiudi forte!

DATI DISPONIBILI: Tutti i dati, focus su pending items con scadenze

TONO: Energico, focalizzato, determinato

VERIFICA AZIONI PRECEDENTI: Verifica azioni importanti del mese ancora pending.',
  updated_at = NOW()
WHERE day_of_month = 21;

-- Day 22
UPDATE email_journey_templates 
SET 
  title = 'Check Tutto Pending',
  description = 'Email completa con tutti gli items pending (esercizi, tasks, obiettivi)',
  email_type = 'urgenza',
  tone = 'professionale',
  priority = 10,
  prompt_template = 'Scrivi un''email completa con tutti gli items pending.

STRUTTURA:
1. Intro: siamo a 6 giorni dalla fine del mese
2. Lista completa e organizzata di tutto ciò che è pending:
   - Esercizi (ordinati per scadenza)
   - Consultation tasks
   - Obiettivi in corso
   - Roadmap items iniziati ma non completati
   - Lezioni università non finite
3. Per ognuno, indica priorità (alta/media/bassa)
4. Suggerisci piano per completare priorità alte nei prossimi giorni
5. Incoraggia focus e determinazione

DATI DISPONIBILI: Tutti i dati pending

VERIFICA AZIONI PRECEDENTI: Lista di tutte le azioni suggerite nel mese non ancora completate.',
  updated_at = NOW()
WHERE day_of_month = 22;

-- Day 23
UPDATE email_journey_templates 
SET 
  title = 'Urgenza Finale',
  description = 'Email urgente per items critici da completare entro fine mese',
  email_type = 'urgenza',
  tone = 'professionale',
  priority = 10,
  prompt_template = 'Scrivi un''email urgente per items critici da completare.

STRUTTURA:
1. Alert: 5 giorni alla fine del mese
2. Focus solo su items CRITICI:
   - Esercizi con scadenza entro 5 giorni
   - Tasks con alta priorità
   - Obiettivi con target date fine mese
3. Per ognuno, indica deadline esatta
4. Suggerisci ordine di completamento
5. Offri supporto urgente se serve
6. Motivazione: ce la puoi fare!

DATI DISPONIBILI: Esercizi e tasks con scadenze imminenti

TONO: Urgente ma supportivo, non ansioso

VERIFICA AZIONI PRECEDENTI: Focus su azioni critiche non completate.',
  updated_at = NOW()
WHERE day_of_month = 23;

-- Day 24
UPDATE email_journey_templates 
SET 
  title = 'Celebrazione Streak',
  description = 'Email per celebrare lo streak e la costanza del cliente',
  email_type = 'celebrazione',
  tone = 'motivazionale',
  priority = 8,
  prompt_template = 'Scrivi un''email per celebrare lo streak del cliente.

STRUTTURA:
1. Celebra lo streak corrente (giorni consecutivi)
2. Evidenzia l''impatto della costanza
3. Confronta con inizio mese o mesi precedenti
4. Incoraggia a mantenere lo streak fino a fine mese (e oltre!)
5. Ricorda che ogni giorno conta
6. Azione: check-in oggi per mantenere streak

DATI DISPONIBILI: Momentum streak, check-ins nel tempo

TONO: Celebrativo, fiero, incoraggiante

VERIFICA AZIONI PRECEDENTI: Non necessaria, focus su celebrazione streak.',
  updated_at = NOW()
WHERE day_of_month = 24;

-- Day 25
UPDATE email_journey_templates 
SET 
  title = 'Preparazione Prossimo Mese',
  description = 'Email per iniziare a pensare agli obiettivi del prossimo mese',
  email_type = 'pianificazione',
  tone = 'professionale',
  priority = 7,
  prompt_template = 'Scrivi un''email per preparare il prossimo mese.

STRUTTURA:
1. Intro: mentre chiudiamo questo mese, pensiamo al prossimo
2. Invita a riflettere su:
   - Cosa ha funzionato bene questo mese
   - Cosa migliorare
   - Nuovi obiettivi per prossimo mese
3. Suggerisci di dedicare 15-20 minuti a pianificare
4. Anticipa che riceverà supporto per pianificazione
5. Focus: chiudi forte questo mese E preparati per il prossimo

DATI DISPONIBILI: Progressi del mese corrente, obiettivi

TONO: Riflessivo ma proattivo

VERIFICA AZIONI PRECEDENTI: Verifica se azioni del mese sono quasi tutte completate.',
  updated_at = NOW()
WHERE day_of_month = 25;

-- Day 26
UPDATE email_journey_templates 
SET 
  title = 'Recap Consulenze Mese',
  description = 'Riassunto di tutte le consulenze del mese con insights chiave',
  email_type = 'follow_up',
  tone = 'professionale',
  priority = 8,
  prompt_template = 'Scrivi un''email di recap delle consulenze del mese.

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

VERIFICA AZIONI PRECEDENTI: Verifica completion di tutte le consultation tasks del mese.',
  updated_at = NOW()
WHERE day_of_month = 26;

-- Day 27
UPDATE email_journey_templates 
SET 
  title = 'Verifica Obiettivi Raggiunti',
  description = 'Email per verificare quali obiettivi sono stati raggiunti questo mese',
  email_type = 'obiettivi',
  tone = 'motivazionale',
  priority = 9,
  prompt_template = 'Scrivi un''email per verificare obiettivi raggiunti.

STRUTTURA:
1. Intro: a 1 giorno dalla fine del mese, verifichiamo obiettivi
2. Per ogni obiettivo attivo:
   - Target value vs current value
   - Progress % 
   - Se raggiunto: CELEBRA! 🎉
   - Se quasi raggiunto: incoraggia sprint finale
   - Se lontano: analizza cosa è mancato (senza giudizio)
3. Celebra anche progressi parziali
4. Ultimo giorno: opportunità per un ultimo push
5. Incoraggiamento finale

DATI DISPONIBILI: Obiettivi con target e current values

VERIFICA AZIONI PRECEDENTI: Verifica se azioni suggerite nel mese hanno contribuito a obiettivi.',
  updated_at = NOW()
WHERE day_of_month = 27;

-- Day 28
UPDATE email_journey_templates 
SET 
  title = 'Conclusione Mese e Pianificazione',
  description = 'Email finale del mese con recap completo e pianificazione per prossimo ciclo',
  email_type = 'recap',
  tone = 'professionale',
  priority = 10,
  prompt_template = 'Scrivi un''email di conclusione del mese completa e dettagliata.

STRUTTURA:
1. RECAP MESE COMPLETO:
   - Esercizi: completati vs assegnati, highlights
   - Università: lezioni viste, moduli completati
   - Momentum: streak finale, media energia/mood
   - Consulenze: numero e insights chiave
   - Roadmap: items completati, progressi fasi
   - Obiettivi: raggiunti vs in corso vs nuovi
   - Libreria: documenti letti

2. CELEBRAZIONI:
   - Lista tutti i successi del mese
   - Celebra crescita e progressi

3. ANALISI:
   - Cosa ha funzionato bene
   - Aree di miglioramento per prossimo mese

4. ANTICIPAZIONE:
   - Il prossimo ciclo di 28 giorni inizia domani
   - Nuovi focus e obiettivi
   - Motivazione per il nuovo mese

5. CHIUSURA:
   - Orgoglio per il lavoro fatto
   - Entusiasmo per ciò che verrà
   - Disponibilità e supporto

DATI DISPONIBILI: TUTTI i dati del mese (28 giorni)

TONO: Riflessivo, celebrativo, motivazionale, professionale

VERIFICA AZIONI PRECEDENTI: Recap finale di TUTTE le azioni suggerite nel mese.',
  updated_at = NOW()
WHERE day_of_month = 28;

-- Day 29
UPDATE email_journey_templates 
SET 
  title = 'Revisione Extra Post-Mese',
  description = 'Email di revisione aggiuntiva per mesi di 29 giorni',
  email_type = 'revisione',
  tone = 'professionale',
  priority = 7,
  prompt_template = 'Scrivi un''email di revisione extra per il giorno 29.

STRUTTURA:
1. Intro: giorno bonus del mese!
2. Revisione rapida di eventuali items lasciati in sospeso ieri
3. Verifica se ci sono:
   - Esercizi completati all''ultimo momento (celebra!)
   - Obiettivi raggiunti dopo la chiusura di ieri
   - Riflessioni aggiuntive
4. Se tutto è stato completato: celebra e invita al riposo
5. Se ci sono pending: ultimo invito gentile a completare
6. Anticipa nuovo ciclo che inizierà tra 1-2 giorni

DATI DISPONIBILI: Tutti i dati

TONO: Leggero, bonus, non pressante

VERIFICA AZIONI PRECEDENTI: Verifica azioni dell''email di ieri (giorno 28).',
  updated_at = NOW()
WHERE day_of_month = 29;

-- Day 30
UPDATE email_journey_templates 
SET 
  title = 'Ultimo Check Mese Lungo',
  description = 'Email finale per mesi di 30 giorni',
  email_type = 'check_finale',
  tone = 'amichevole',
  priority = 8,
  prompt_template = 'Scrivi un''email per l''ultimo giorno di un mese di 30 giorni.

STRUTTURA:
1. Intro: ultimo giorno del mese lungo
2. Verifica finale di tutti gli items pending:
   - Esercizi ancora da completare
   - Tasks non finite
   - Obiettivi quasi raggiunti
3. Se possibile completare oggi: incoraggia
4. Se no: rassicura che c''è domani (se mese di 31) o che il prossimo ciclo inizierà domani
5. Celebra il mese completato
6. Invita a preparare mente e cuore per nuovo ciclo

DATI DISPONIBILI: Tutti i dati

TONO: Conclusivo ma sereno, non ansioso

VERIFICA AZIONI PRECEDENTI: Check rapido degli ultimi 2 giorni.',
  updated_at = NOW()
WHERE day_of_month = 30;

-- Day 31
UPDATE email_journey_templates 
SET 
  title = 'Chiusura Finale Estesa',
  description = 'Email di chiusura per mesi di 31 giorni',
  email_type = 'chiusura_estesa',
  tone = 'motivazionale',
  priority = 9,
  prompt_template = 'Scrivi un''email di chiusura finale per il giorno 31.

STRUTTURA:
1. Intro celebrativa: ultimo giorno di un mese completo di 31 giorni!
2. Recap finale veloce:
   - Highlights del mese
   - Celebra la costanza (31 giorni!)
3. Ultimi items pending:
   - Se ci sono: ultimo invito senza pressione
   - Se tutto completato: celebrazione massima
4. Chiusura emozionale del mese:
   - Cosa hai imparato
   - Come sei cresciuto
   - Di cosa sei orgoglioso
5. Entusiasmo per domani che inizia nuovo ciclo
6. Riposo meritato stasera

DATI DISPONIBILI: Tutti i dati del mese completo

TONO: Celebrativo, riflessivo, emozionale, motivante

VERIFICA AZIONI PRECEDENTI: Recap finale di tutto il mese.',
  updated_at = NOW()
WHERE day_of_month = 31;

COMMIT;

-- Verify updates
SELECT day_of_month, title, email_type, tone, priority, 
       LENGTH(prompt_template) as new_prompt_length,
       updated_at
FROM email_journey_templates 
ORDER BY day_of_month;
