/**
 * GUIDA COMPLETA PIATTAFORMA CLIENTE
 * 
 * Questa guida documenta OGNI pagina e funzionalità disponibili per i CLIENTI.
 * Viene usata da:
 * 1. AI Assistant (lato cliente) - come contesto per rispondere alle domande
 * 2. File Search - sincronizzata automaticamente per ogni cliente
 * 
 * STRUTTURA NAVIGAZIONE CLIENTE:
 * La sidebar del cliente è organizzata in sezioni espandibili con sottomenu.
 * Ogni sezione ha un'icona e può contenere più voci.
 * 
 * ULTIMO AGGIORNAMENTO: 27 Dicembre 2025
 */

export interface ClientGuideStep {
  title: string;
  content: string;
  actionText?: string;
  actionHref?: string;
  tips?: string[];
  warnings?: string[];
}

export interface ClientGuideSection {
  title: string;
  icon: string;
  description: string;
  steps: ClientGuideStep[];
}

export interface ClientGuide {
  emoji: string;
  title: string;
  path: string;
  navigation: string; // Percorso di navigazione esatto: "Menu > Sottomenu > Pagina"
  description: string;
  category: 'dashboard' | 'ai' | 'formazione' | 'tempo' | 'agenti' | 'venditori' | 'knowledge' | 'impostazioni';
  sections: ClientGuideSection[];
}

export interface ClientGuides {
  [key: string]: ClientGuide;
}

export const clientGuides: ClientGuides = {

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 1: DASHBOARD - Home e Panoramica
  // ═══════════════════════════════════════════════════════════════════

  dashboard: {
    emoji: "🏠",
    title: "Dashboard Cliente",
    path: "/client",
    navigation: "Sidebar → Dashboard",
    description: "La tua home personale. Visualizza a colpo d'occhio i tuoi progressi, le prossime attività, e accedi rapidamente a tutte le funzionalità.",
    category: "dashboard",
    sections: [
      {
        title: "PANORAMICA DASHBOARD",
        icon: "📊",
        description: "La dashboard ti mostra tutto ciò che è importante per il tuo percorso.",
        steps: [
          {
            title: "Come Accedere",
            content: "La dashboard è la prima pagina che vedi dopo il login. Puoi sempre tornare qui cliccando 'Dashboard' nella sidebar a sinistra.",
            actionText: "Vai a Dashboard",
            actionHref: "/client"
          },
          {
            title: "Cosa Trovi nella Dashboard",
            content: "Nella dashboard trovi: 1) I tuoi progressi formativi (percentuale corsi completati), 2) Esercizi da completare con scadenze, 3) Prossime consulenze programmate, 4) Task giornalieri, 5) Accesso rapido all'AI Assistant."
          },
          {
            title: "Widget Progressi",
            content: "Il widget progressi mostra la percentuale di completamento del tuo percorso formativo. Clicca per vedere i dettagli di ogni corso.",
            tips: ["I progressi si aggiornano automaticamente quando completi lezioni o esercizi"]
          },
          {
            title: "Widget Esercizi",
            content: "Mostra gli esercizi assegnati dal tuo consulente con le relative scadenze. Gli esercizi in scadenza sono evidenziati in rosso.",
            tips: ["Clicca su un esercizio per aprirlo e completarlo"],
            warnings: ["Rispetta le scadenze per non accumulare ritardi nel percorso"]
          },
          {
            title: "Widget Consulenze",
            content: "Visualizza le tue prossime consulenze con data, ora e link per partecipare.",
            tips: ["Il link per la videochiamata appare 15 minuti prima dell'inizio"]
          }
        ]
      },
      {
        title: "NAVIGAZIONE RAPIDA",
        icon: "🧭",
        description: "Dalla dashboard puoi accedere rapidamente a tutte le sezioni.",
        steps: [
          {
            title: "Sidebar Laterale",
            content: "La sidebar a sinistra contiene tutte le sezioni principali. Clicca su una voce per espandere il sottomenu, poi seleziona la pagina desiderata."
          },
          {
            title: "Sezioni Disponibili",
            content: "Le sezioni principali sono: AI Assistant (chat e consulenze AI), La Mia Università (corsi ed esercizi), Il Mio Tempo (calendario e task), Agenti AI (se abilitati), Venditori Umani (se abilitati), Base di Conoscenza (documenti)."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 2: AI ASSISTANT - Chat e Consulenze AI
  // ═══════════════════════════════════════════════════════════════════

  aiAssistant: {
    emoji: "✨",
    title: "AI Assistant - Chat",
    path: "/client/ai-assistant",
    navigation: "Sidebar → AI Assistant → Chat AI",
    description: "Il tuo assistente personale basato su intelligenza artificiale. Chiedi qualsiasi cosa sul tuo percorso, sui contenuti formativi, o ricevi supporto personalizzato.",
    category: "ai",
    sections: [
      {
        title: "COME USARE LA CHAT AI",
        icon: "💬",
        description: "Interagisci con l'AI per ricevere supporto immediato su qualsiasi argomento.",
        steps: [
          {
            title: "Avviare una Conversazione",
            content: "Scrivi la tua domanda nel campo in basso e premi Invio. L'AI risponde in tempo reale. Puoi fare domande sui tuoi corsi, esercizi, finanze personali, o chiedere consigli.",
            actionText: "Vai a Chat AI",
            actionHref: "/client/ai-assistant"
          },
          {
            title: "Gestire le Conversazioni",
            content: "Nella sidebar sinistra della chat trovi tutte le tue conversazioni salvate. Clicca su 'Nuova chat' per iniziare una nuova conversazione, oppure seleziona una conversazione precedente per continuarla.",
            tips: ["Le conversazioni sono salvate automaticamente", "Puoi cercare tra le conversazioni usando la barra di ricerca"]
          },
          {
            title: "Filtri Conversazioni",
            content: "Usa i filtri per trovare rapidamente le conversazioni: 'Tutte' mostra tutto, 'Assistenza' mostra le chat di supporto, 'Consulente' mostra le chat in modalità consulente, 'Vocale' mostra le conversazioni vocali."
          },
          {
            title: "Selezione Agente",
            content: "Se il tuo consulente ha condiviso degli agenti AI con te, puoi selezionarli dal dropdown nell'header della chat. Ogni agente ha una personalità e competenze specifiche.",
            tips: ["L'Assistente Base è sempre disponibile", "Gli agenti specializzati possono avere conoscenze specifiche"]
          }
        ]
      },
      {
        title: "COSA PUOI CHIEDERE ALL'AI",
        icon: "🎯",
        description: "Esempi di domande e richieste che puoi fare.",
        steps: [
          {
            title: "Domande sui Corsi",
            content: "Chiedi 'Spiegami la lezione X' o 'Quali sono i punti chiave del modulo Y' per ricevere spiegazioni personalizzate sui contenuti formativi."
          },
          {
            title: "Aiuto con gli Esercizi",
            content: "Chiedi 'Aiutami con l'esercizio X' o 'Non capisco come completare questo esercizio' per ricevere guida step-by-step."
          },
          {
            title: "Consigli Finanziari",
            content: "Se il tuo percorso include finanza personale, chiedi 'Come posso risparmiare di più?' o 'Analizza le mie spese' per insights personalizzati.",
            tips: ["L'AI ha accesso ai tuoi dati finanziari dal software Percorso Capitale se collegato"]
          },
          {
            title: "Progressi e Obiettivi",
            content: "Chiedi 'Come sto andando?' o 'Quali sono i miei prossimi step?' per un riepilogo dei tuoi progressi e suggerimenti su come procedere."
          },
          {
            title: "Supporto Tecnico",
            content: "Chiedi 'Come faccio a...' per ricevere istruzioni su qualsiasi funzionalità della piattaforma."
          }
        ]
      },
      {
        title: "PREFERENZE AI",
        icon: "⚙️",
        description: "Personalizza come l'AI comunica con te.",
        steps: [
          {
            title: "Aprire le Preferenze",
            content: "Clicca l'icona ingranaggio nell'header della chat per aprire il pannello preferenze AI."
          },
          {
            title: "Stili di Scrittura",
            content: "Scegli tra 9 stili: Predefinito (naturale), Professionale (formale), Amichevole (caloroso), Schietto (diretto), Eccentrico (vivace), Efficiente (essenziale), Nerd (approfondito), Cinico (critico), Personalizzato (istruzioni tue).",
            tips: ["Lo stile 'Predefinito' funziona bene per la maggior parte delle situazioni"]
          },
          {
            title: "Lunghezza Risposte",
            content: "Scegli tra: Breve (risposte concise), Bilanciata (equilibrio), Completa (risposte dettagliate)."
          },
          {
            title: "Istruzioni Personalizzate",
            content: "Se scegli lo stile 'Personalizzato', puoi scrivere istruzioni specifiche che l'AI seguirà sempre nelle tue conversazioni."
          }
        ]
      }
    ]
  },

  aiConsultationsHistory: {
    emoji: "📜",
    title: "Storico Consulenze AI",
    path: "/client/ai-consultations-history",
    navigation: "Sidebar → AI Assistant → Consulenze AI",
    description: "Visualizza lo storico delle consulenze gestite dall'AI, inclusi riepiloghi e trascrizioni.",
    category: "ai",
    sections: [
      {
        title: "STORICO CONSULENZE",
        icon: "📋",
        description: "Rivedi tutte le consulenze passate con l'AI.",
        steps: [
          {
            title: "Accedere allo Storico",
            content: "Vai su AI Assistant → Consulenze AI per vedere l'elenco di tutte le consulenze AI che hai avuto.",
            actionText: "Vai a Storico Consulenze",
            actionHref: "/client/ai-consultations-history"
          },
          {
            title: "Cosa Trovi",
            content: "Per ogni consulenza vedi: data e ora, durata, argomenti trattati, e un riepilogo generato dall'AI."
          },
          {
            title: "Dettaglio Consulenza",
            content: "Clicca su una consulenza per vedere tutti i dettagli: trascrizione completa (se disponibile), punti chiave, task assegnati, e note."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 3: LA MIA UNIVERSITÀ - Formazione
  // ═══════════════════════════════════════════════════════════════════

  university: {
    emoji: "🎓",
    title: "Università",
    path: "/client/university",
    navigation: "Sidebar → La Mia Università → Università",
    description: "I tuoi corsi formativi. Segui le lezioni, completa i moduli, e traccia i tuoi progressi nel percorso di apprendimento.",
    category: "formazione",
    sections: [
      {
        title: "I TUOI CORSI",
        icon: "📚",
        description: "Visualizza e segui tutti i corsi assegnati dal tuo consulente.",
        steps: [
          {
            title: "Accedere ai Corsi",
            content: "Dalla sidebar, clicca su 'La Mia Università' per espandere il menu, poi seleziona 'Università'. Vedrai l'elenco di tutti i corsi a cui sei iscritto.",
            actionText: "Vai a Università",
            actionHref: "/client/university"
          },
          {
            title: "Struttura dei Corsi",
            content: "Ogni corso è organizzato in moduli, e ogni modulo contiene una o più lezioni. Completa le lezioni in ordine per massimizzare l'apprendimento."
          },
          {
            title: "Barra di Progresso",
            content: "Ogni corso mostra una barra di progresso che indica la percentuale di completamento. La barra si aggiorna automaticamente quando completi le lezioni.",
            tips: ["Alcune lezioni potrebbero essere bloccate finché non completi quelle precedenti"]
          },
          {
            title: "Iniziare una Lezione",
            content: "Clicca su un corso per vedere i moduli, poi clicca su una lezione per aprirla. Le lezioni possono contenere video, testo, immagini, e quiz."
          }
        ]
      },
      {
        title: "COMPLETARE LE LEZIONI",
        icon: "✅",
        description: "Come seguire e completare le lezioni.",
        steps: [
          {
            title: "Leggere il Contenuto",
            content: "Ogni lezione presenta il contenuto formativo. Leggi attentamente tutto il materiale prima di marcare la lezione come completata."
          },
          {
            title: "Video nelle Lezioni",
            content: "Se una lezione contiene un video, guardalo per intero. Il sistema può tracciare quanto del video hai visto.",
            tips: ["Puoi mettere in pausa e riprendere i video", "Alcuni video hanno quiz intermedi"]
          },
          {
            title: "Marcare come Completata",
            content: "Una volta finita la lezione, clicca il pulsante 'Completa Lezione' o 'Segna come letta'. La tua progressione sarà salvata.",
            tips: ["Puoi sempre tornare a rivedere lezioni già completate"]
          },
          {
            title: "Quiz e Verifiche",
            content: "Alcune lezioni terminano con un quiz di verifica. Rispondi alle domande per verificare la comprensione. Puoi ripetere i quiz se non superi al primo tentativo."
          }
        ]
      }
    ]
  },

  clientExercises: {
    emoji: "📝",
    title: "I Miei Esercizi",
    path: "/client/exercises",
    navigation: "Sidebar → La Mia Università → I Miei Esercizi",
    description: "Gli esercizi pratici assegnati dal tuo consulente. Completa gli esercizi per applicare quanto appreso e ricevi feedback personalizzato.",
    category: "formazione",
    sections: [
      {
        title: "ELENCO ESERCIZI",
        icon: "📋",
        description: "Visualizza tutti gli esercizi assegnati a te.",
        steps: [
          {
            title: "Accedere agli Esercizi",
            content: "Dalla sidebar, clicca su 'La Mia Università' → 'I Miei Esercizi'. Vedrai l'elenco di tutti gli esercizi con il loro stato.",
            actionText: "Vai a Esercizi",
            actionHref: "/client/exercises"
          },
          {
            title: "Stati degli Esercizi",
            content: "Ogni esercizio ha uno stato: 'Da completare' (in attesa), 'In corso' (hai iniziato), 'Consegnato' (inviato al consulente), 'Revisionato' (feedback ricevuto)."
          },
          {
            title: "Priorità e Scadenze",
            content: "Gli esercizi possono avere scadenze e priorità. Gli esercizi urgenti sono evidenziati. Rispetta le scadenze per restare al passo con il percorso.",
            warnings: ["Gli esercizi scaduti potrebbero bloccare l'accesso a nuovi contenuti"]
          },
          {
            title: "Badge Notifiche",
            content: "Il numero nella sidebar indica quanti esercizi hai da completare.",
            tips: ["Il badge si aggiorna quando completi o ricevi nuovi esercizi"]
          }
        ]
      },
      {
        title: "COMPLETARE UN ESERCIZIO",
        icon: "✏️",
        description: "Come lavorare su un esercizio e consegnarlo.",
        steps: [
          {
            title: "Aprire l'Esercizio",
            content: "Clicca su un esercizio per aprirlo. Vedrai le istruzioni complete, i materiali allegati, e il form per la consegna."
          },
          {
            title: "Leggere le Istruzioni",
            content: "Leggi attentamente tutte le istruzioni prima di iniziare. L'esercizio può richiedere risposte scritte, upload di file, o compilazione di form."
          },
          {
            title: "Compilare le Risposte",
            content: "Compila tutti i campi richiesti. Alcuni campi sono obbligatori (marcati con asterisco). Puoi salvare come bozza e completare in seguito."
          },
          {
            title: "Allegare File",
            content: "Se l'esercizio richiede allegati, usa il pulsante 'Carica file' per uploadare documenti, immagini, o altri materiali.",
            tips: ["Formati supportati: PDF, DOC, DOCX, immagini", "Dimensione massima file: solitamente 10MB"]
          },
          {
            title: "Consegnare l'Esercizio",
            content: "Quando hai completato tutto, clicca 'Consegna'. L'esercizio sarà inviato al tuo consulente per la revisione.",
            warnings: ["Una volta consegnato, non puoi modificare le risposte"]
          }
        ]
      },
      {
        title: "FEEDBACK E REVISIONE",
        icon: "💬",
        description: "Ricevere e leggere il feedback del consulente.",
        steps: [
          {
            title: "Notifica di Revisione",
            content: "Quando il consulente revisiona il tuo esercizio, ricevi una notifica. L'esercizio passa allo stato 'Revisionato'."
          },
          {
            title: "Leggere il Feedback",
            content: "Apri l'esercizio revisionato per vedere il feedback del consulente: commenti, suggerimenti, e valutazione."
          },
          {
            title: "Esercizi da Rifare",
            content: "In alcuni casi il consulente può chiederti di rifare l'esercizio. Segui le indicazioni nel feedback per migliorare.",
            tips: ["Usa il feedback come opportunità di apprendimento"]
          }
        ]
      }
    ]
  },

  clientLibrary: {
    emoji: "📖",
    title: "Corsi - Libreria",
    path: "/client/library",
    navigation: "Sidebar → La Mia Università → Corsi",
    description: "La libreria completa dei corsi disponibili. Esplora tutti i contenuti formativi organizzati per categoria.",
    category: "formazione",
    sections: [
      {
        title: "ESPLORARE LA LIBRERIA",
        icon: "📚",
        description: "Naviga tra tutti i corsi disponibili.",
        steps: [
          {
            title: "Accedere alla Libreria",
            content: "Dalla sidebar, clicca su 'La Mia Università' → 'Corsi'. Vedrai tutti i corsi disponibili nel tuo percorso.",
            actionText: "Vai a Libreria Corsi",
            actionHref: "/client/library"
          },
          {
            title: "Filtri e Ricerca",
            content: "Usa la barra di ricerca per trovare corsi specifici. Puoi filtrare per categoria, stato (completato/in corso/da iniziare), o livello di difficoltà."
          },
          {
            title: "Card dei Corsi",
            content: "Ogni corso è mostrato come una card con: titolo, descrizione breve, numero di moduli/lezioni, tempo stimato, e barra di progresso."
          },
          {
            title: "Dettaglio Corso",
            content: "Clicca su una card per vedere il dettaglio del corso: descrizione completa, elenco moduli, prerequisiti, e obiettivi di apprendimento."
          }
        ]
      },
      {
        title: "LEGGERE UN DOCUMENTO",
        icon: "📄",
        description: "Come leggere i documenti e le lezioni nella libreria.",
        steps: [
          {
            title: "Aprire una Lezione",
            content: "Dal dettaglio corso, clicca su una lezione per aprirla. La lezione si apre in una vista di lettura ottimizzata.",
            actionText: "Vai a Lezione",
            actionHref: "/client/library/:documentId"
          },
          {
            title: "Navigazione tra Lezioni",
            content: "Usa i pulsanti 'Precedente' e 'Successiva' per navigare tra le lezioni senza tornare all'elenco."
          },
          {
            title: "Segnalibri",
            content: "Puoi salvare lezioni importanti come segnalibri per ritrovarle velocemente.",
            tips: ["I segnalibri sono personali e salvati nel tuo profilo"]
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 4: IL MIO TEMPO - Calendario, Task, Consulenze
  // ═══════════════════════════════════════════════════════════════════

  clientCalendar: {
    emoji: "📅",
    title: "Calendario",
    path: "/client/calendar",
    navigation: "Sidebar → Il Mio Tempo → Calendario",
    description: "Il tuo calendario personale. Visualizza consulenze, scadenze esercizi, e tutti gli appuntamenti del tuo percorso.",
    category: "tempo",
    sections: [
      {
        title: "VISUALIZZARE IL CALENDARIO",
        icon: "📆",
        description: "Naviga tra le date e visualizza i tuoi impegni.",
        steps: [
          {
            title: "Accedere al Calendario",
            content: "Dalla sidebar, clicca su 'Il Mio Tempo' → 'Calendario'. Vedrai il calendario con tutti i tuoi impegni.",
            actionText: "Vai a Calendario",
            actionHref: "/client/calendar"
          },
          {
            title: "Viste Disponibili",
            content: "Puoi visualizzare il calendario in vista: Mese (panoramica mensile), Settimana (dettaglio settimanale), Giorno (dettaglio giornaliero)."
          },
          {
            title: "Navigare tra le Date",
            content: "Usa le frecce per spostarti tra i mesi/settimane. Clicca su 'Oggi' per tornare alla data corrente."
          },
          {
            title: "Tipi di Eventi",
            content: "Gli eventi sono colorati per tipo: Consulenze (verde), Scadenze esercizi (rosso), Task (blu), Appuntamenti generici (grigio)."
          }
        ]
      },
      {
        title: "DETTAGLI EVENTI",
        icon: "📋",
        description: "Visualizzare i dettagli di un evento.",
        steps: [
          {
            title: "Aprire un Evento",
            content: "Clicca su un evento nel calendario per vedere tutti i dettagli: titolo, data/ora, descrizione, e link utili."
          },
          {
            title: "Consulenze",
            content: "Per le consulenze vedrai: nome consulente, durata, note preparatorie, e il link per partecipare alla videochiamata.",
            tips: ["Il link videochiamata appare 15 minuti prima dell'inizio"]
          },
          {
            title: "Scadenze Esercizi",
            content: "Per le scadenze esercizi, clicca per andare direttamente all'esercizio da completare."
          }
        ]
      }
    ]
  },

  dailyTasks: {
    emoji: "✅",
    title: "Task & Riflessioni",
    path: "/client/daily-tasks",
    navigation: "Sidebar → Il Mio Tempo → Task & Riflessioni",
    description: "I tuoi task giornalieri e il diario delle riflessioni. Traccia le attività quotidiane e annota i tuoi pensieri sul percorso.",
    category: "tempo",
    sections: [
      {
        title: "TASK GIORNALIERI",
        icon: "📝",
        description: "Gestisci le tue attività quotidiane.",
        steps: [
          {
            title: "Accedere ai Task",
            content: "Dalla sidebar, clicca su 'Il Mio Tempo' → 'Task & Riflessioni'. Vedrai i task da completare oggi e quelli futuri.",
            actionText: "Vai a Task",
            actionHref: "/client/daily-tasks"
          },
          {
            title: "Completare un Task",
            content: "Clicca sulla checkbox accanto a un task per marcarlo come completato. Il task scompare dalla lista attiva."
          },
          {
            title: "Task Ricorrenti",
            content: "Alcuni task sono ricorrenti (giornalieri o settimanali). Si ripresentano automaticamente secondo la frequenza impostata."
          },
          {
            title: "Priorità",
            content: "I task urgenti sono evidenziati. Concentrati prima su quelli ad alta priorità.",
            tips: ["Completa i task importanti al mattino per massimizzare la produttività"]
          }
        ]
      },
      {
        title: "RIFLESSIONI",
        icon: "💭",
        description: "Il tuo diario personale di riflessioni.",
        steps: [
          {
            title: "Scrivere una Riflessione",
            content: "Nella sezione riflessioni puoi annotare pensieri, dubbi, successi, o qualsiasi cosa relativa al tuo percorso."
          },
          {
            title: "Vantaggi delle Riflessioni",
            content: "Le riflessioni ti aiutano a: tracciare il tuo progresso emotivo, identificare pattern, preparare argomenti per le consulenze.",
            tips: ["Il consulente può vedere le tue riflessioni (se condivise) per preparare meglio le sessioni"]
          }
        ]
      }
    ]
  },

  momentum: {
    emoji: "⚡",
    title: "Momentum",
    path: "/client/calendar?tab=momentum",
    navigation: "Sidebar → Il Mio Tempo → Momentum",
    description: "Traccia il tuo momentum e la costanza nel percorso. Visualizza streak, statistiche di engagement, e mantieni la motivazione alta.",
    category: "tempo",
    sections: [
      {
        title: "COS'È IL MOMENTUM",
        icon: "🔥",
        description: "Il momentum misura la tua costanza nel seguire il percorso.",
        steps: [
          {
            title: "Accedere al Momentum",
            content: "Dalla sidebar, clicca su 'Il Mio Tempo' → 'Momentum'. Vedrai le tue statistiche di engagement.",
            actionText: "Vai a Momentum",
            actionHref: "/client/calendar?tab=momentum"
          },
          {
            title: "Streak Giornaliero",
            content: "Lo streak indica quanti giorni consecutivi hai interagito con la piattaforma. Mantieni lo streak alto per migliori risultati!",
            tips: ["Anche un piccolo login conta per mantenere lo streak"]
          },
          {
            title: "Statistiche",
            content: "Visualizza: giorni attivi questo mese, lezioni completate, esercizi consegnati, tempo medio di studio."
          }
        ]
      }
    ]
  },

  clientConsultations: {
    emoji: "🗓️",
    title: "Consulenze",
    path: "/client/consultations",
    navigation: "Sidebar → Il Mio Tempo → Consulenze",
    description: "Storico e gestione delle tue consulenze con il consulente. Visualizza appuntamenti passati e futuri, note, e riepiloghi.",
    category: "tempo",
    sections: [
      {
        title: "LE TUE CONSULENZE",
        icon: "👥",
        description: "Gestisci tutti gli appuntamenti con il tuo consulente.",
        steps: [
          {
            title: "Accedere alle Consulenze",
            content: "Dalla sidebar, clicca su 'Il Mio Tempo' → 'Consulenze'. Vedrai tutte le consulenze passate e future.",
            actionText: "Vai a Consulenze",
            actionHref: "/client/consultations"
          },
          {
            title: "Consulenze Future",
            content: "La sezione 'Prossime' mostra gli appuntamenti schedulati. Clicca per vedere dettagli e link per partecipare."
          },
          {
            title: "Consulenze Passate",
            content: "La sezione 'Passate' mostra lo storico. Per ogni consulenza puoi vedere: durata, note, riepilogo, task emersi."
          },
          {
            title: "Prepararsi per una Consulenza",
            content: "Prima di una consulenza: rivedi le lezioni assegnate, completa gli esercizi pendenti, prepara domande da fare.",
            tips: ["Scrivi le domande in anticipo nelle tue riflessioni"]
          }
        ]
      },
      {
        title: "PARTECIPARE A UNA CONSULENZA",
        icon: "📹",
        description: "Come partecipare alla videochiamata.",
        steps: [
          {
            title: "Link Videochiamata",
            content: "15 minuti prima dell'inizio, apparirà il pulsante 'Partecipa' con il link alla videochiamata."
          },
          {
            title: "Requisiti Tecnici",
            content: "Assicurati di avere: connessione internet stabile, webcam e microfono funzionanti, ambiente silenzioso.",
            warnings: ["Testa audio/video prima della consulenza"]
          },
          {
            title: "Durante la Consulenza",
            content: "Prendi appunti, fai domande, e sii attivo nella discussione. Il consulente potrebbe condividere lo schermo o assegnarti task."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 5: AGENTI AI - Sales Agents (se abilitato)
  // ═══════════════════════════════════════════════════════════════════

  salesAgents: {
    emoji: "🤖",
    title: "I Miei Agenti AI",
    path: "/client/sales-agents",
    navigation: "Sidebar → Agenti AI → I Miei Agenti AI",
    description: "Gestisci i tuoi agenti AI per la vendita. Crea, configura, e monitora le performance dei bot che vendono per te.",
    category: "agenti",
    sections: [
      {
        title: "PANORAMICA AGENTI",
        icon: "🤖",
        description: "Visualizza tutti i tuoi agenti AI configurati.",
        steps: [
          {
            title: "Accedere agli Agenti",
            content: "Dalla sidebar, clicca su 'Agenti AI' → 'I Miei Agenti AI'. Vedrai la lista di tutti i tuoi agenti con statistiche rapide.",
            actionText: "Vai a Agenti AI",
            actionHref: "/client/sales-agents"
          },
          {
            title: "Card Agente",
            content: "Ogni agente mostra: nome, tipo (vendita/supporto), stato (attivo/pausa), numero conversazioni, tasso conversione."
          },
          {
            title: "Stato Agente",
            content: "Un agente può essere: Attivo (risponde ai messaggi), In Pausa (non risponde), In Configurazione (non pronto)."
          },
          {
            title: "Selezionare un Agente",
            content: "Clicca su un agente per vedere i dettagli completi, le conversazioni, e le statistiche dettagliate.",
            actionText: "Dettaglio Agente",
            actionHref: "/client/sales-agents/:agentId"
          }
        ]
      },
      {
        title: "CREARE UN NUOVO AGENTE",
        icon: "➕",
        description: "Come creare e configurare un nuovo agente AI.",
        steps: [
          {
            title: "Nuovo Agente",
            content: "Clicca su 'Nuovo Agente AI' per avviare la procedura di creazione.",
            actionText: "Crea Nuovo Agente",
            actionHref: "/client/sales-agents/new"
          },
          {
            title: "Configurazione Base",
            content: "Inserisci: nome agente, tipo (vendita/supporto), descrizione del ruolo, e personalità."
          },
          {
            title: "Script e Istruzioni",
            content: "Definisci come l'agente deve comportarsi: script di apertura, domande da fare, obiezioni da gestire.",
            tips: ["Più dettagliate sono le istruzioni, migliore sarà la performance"]
          }
        ]
      },
      {
        title: "ANALYTICS AGENTE",
        icon: "📊",
        description: "Monitora le performance dei tuoi agenti.",
        steps: [
          {
            title: "Accedere alle Analytics",
            content: "Dal dettaglio agente, clicca su 'Analytics' per vedere tutte le statistiche.",
            actionText: "Vai a Analytics",
            actionHref: "/client/sales-agents/:agentId/analytics"
          },
          {
            title: "Metriche Disponibili",
            content: "Visualizza: conversazioni totali, tasso risposta, tempo medio conversazione, lead qualificati, appuntamenti fissati, conversioni."
          },
          {
            title: "Grafici Temporali",
            content: "Analizza i trend nel tempo: confronta periodi, identifica pattern, trova aree di miglioramento."
          }
        ]
      }
    ]
  },

  clientScripts: {
    emoji: "📜",
    title: "Script Manager",
    path: "/client/scripts",
    navigation: "Sidebar → Agenti AI → Script Manager",
    description: "Gestisci gli script di vendita per i tuoi agenti AI. Crea, modifica, e testa gli script per ottimizzare le conversazioni.",
    category: "agenti",
    sections: [
      {
        title: "GESTIONE SCRIPT",
        icon: "📝",
        description: "Visualizza e gestisci tutti gli script disponibili.",
        steps: [
          {
            title: "Accedere agli Script",
            content: "Dalla sidebar, clicca su 'Agenti AI' → 'Script Manager'. Vedrai tutti gli script creati.",
            actionText: "Vai a Script",
            actionHref: "/client/scripts"
          },
          {
            title: "Tipi di Script",
            content: "Gli script possono essere di diversi tipi: Apertura (primo messaggio), Qualificazione (domande), Obiezioni (risposte), Chiusura (call-to-action)."
          },
          {
            title: "Script Builder",
            content: "Usa lo Script Builder per creare script visualmente con un editor drag-and-drop.",
            actionText: "Apri Builder",
            actionHref: "/client/scripts/builder"
          }
        ]
      }
    ]
  },

  liveConsultation: {
    emoji: "📹",
    title: "Live Consultation",
    path: "/live-consultation",
    navigation: "Sidebar → Agenti AI → Live Consultation",
    description: "Partecipa a consulenze live con supporto AI in tempo reale. L'AI ti assiste durante le chiamate con suggerimenti e informazioni.",
    category: "agenti",
    sections: [
      {
        title: "CONSULENZA LIVE CON AI",
        icon: "🎥",
        description: "Come funziona la consulenza assistita dall'AI.",
        steps: [
          {
            title: "Cos'è la Live Consultation",
            content: "Durante una videochiamata, l'AI ti assiste in tempo reale: suggerisce risposte, recupera informazioni, e prende appunti automaticamente."
          },
          {
            title: "Avviare una Sessione",
            content: "Accedi alla Live Consultation quando hai una chiamata programmata. L'AI si attiva automaticamente.",
            actionText: "Vai a Live Consultation",
            actionHref: "/live-consultation"
          },
          {
            title: "Suggerimenti AI",
            content: "L'AI ascolta la conversazione e mostra suggerimenti contestuali: risposte a domande, obiezioni comuni, next steps."
          }
        ]
      }
    ]
  },

  clientAIAnalytics: {
    emoji: "📈",
    title: "AI Analytics",
    path: "/client/analytics/vertex-ai",
    navigation: "Sidebar → Agenti AI → AI Analytics",
    description: "Analytics dettagliate sull'utilizzo dell'AI: token consumati, conversazioni, performance modelli.",
    category: "agenti",
    sections: [
      {
        title: "ANALYTICS AI",
        icon: "📊",
        description: "Monitora l'utilizzo delle risorse AI.",
        steps: [
          {
            title: "Accedere alle Analytics",
            content: "Dalla sidebar, clicca su 'Agenti AI' → 'AI Analytics'. Vedrai tutte le statistiche di utilizzo AI.",
            actionText: "Vai a AI Analytics",
            actionHref: "/client/analytics/vertex-ai"
          },
          {
            title: "Metriche Principali",
            content: "Visualizza: token consumati (input/output), costo stimato, numero richieste, tempo medio risposta."
          },
          {
            title: "Breakdown per Agente",
            content: "Analizza quali agenti consumano più risorse e ottimizza di conseguenza."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 6: VENDITORI UMANI (se abilitato)
  // ═══════════════════════════════════════════════════════════════════

  humanSellers: {
    emoji: "👥",
    title: "I Miei Venditori",
    path: "/client/human-sellers",
    navigation: "Sidebar → Venditori Umani → I Miei Venditori",
    description: "Gestisci il tuo team di venditori umani. Assegna lead, monitora performance, e coordina le attività di vendita.",
    category: "venditori",
    sections: [
      {
        title: "TEAM VENDITORI",
        icon: "👥",
        description: "Visualizza e gestisci il tuo team.",
        steps: [
          {
            title: "Accedere ai Venditori",
            content: "Dalla sidebar, clicca su 'Venditori Umani' → 'I Miei Venditori'. Vedrai l'elenco di tutti i venditori nel tuo team.",
            actionText: "Vai a Venditori",
            actionHref: "/client/human-sellers"
          },
          {
            title: "Card Venditore",
            content: "Ogni venditore mostra: nome, foto, stato (disponibile/occupato), lead assegnati, appuntamenti oggi."
          },
          {
            title: "Dettaglio Venditore",
            content: "Clicca su un venditore per vedere: storico lead, conversazioni, performance, calendario.",
            actionText: "Dettaglio Venditore",
            actionHref: "/client/human-sellers/:id"
          }
        ]
      },
      {
        title: "ANALYTICS VENDITORI",
        icon: "📊",
        description: "Monitora le performance del team.",
        steps: [
          {
            title: "Accedere alle Analytics",
            content: "Clicca su 'Analytics Venditori' per vedere le statistiche aggregate del team.",
            actionText: "Vai a Analytics",
            actionHref: "/client/human-sellers/analytics"
          },
          {
            title: "Metriche",
            content: "Visualizza: lead gestiti, appuntamenti fissati, conversioni, tempo medio gestione, classifica venditori."
          }
        ]
      }
    ]
  },

  humanSellersMeetings: {
    emoji: "📹",
    title: "Video Meetings",
    path: "/client/human-sellers/meetings",
    navigation: "Sidebar → Venditori Umani → Video Meetings",
    description: "Gestisci i video meeting del team vendite. Visualizza registrazioni, trascrizioni, e analytics delle chiamate.",
    category: "venditori",
    sections: [
      {
        title: "MEETINGS",
        icon: "🎥",
        description: "Gestione video meetings.",
        steps: [
          {
            title: "Accedere ai Meetings",
            content: "Dalla sidebar, clicca su 'Venditori Umani' → 'Video Meetings'. Vedrai l'elenco dei meeting programmati e passati.",
            actionText: "Vai a Meetings",
            actionHref: "/client/human-sellers/meetings"
          },
          {
            title: "Registrazioni",
            content: "I meeting registrati mostrano: durata, partecipanti, trascrizione (se disponibile), e punti chiave estratti dall'AI."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 7: BASE DI CONOSCENZA
  // ═══════════════════════════════════════════════════════════════════

  clientKnowledgeDocs: {
    emoji: "📄",
    title: "Documenti",
    path: "/client/knowledge-documents",
    navigation: "Sidebar → Base di Conoscenza → Documenti",
    description: "I documenti della tua knowledge base personale. Carica materiali che l'AI userà per rispondere alle tue domande.",
    category: "knowledge",
    sections: [
      {
        title: "I TUOI DOCUMENTI",
        icon: "📁",
        description: "Gestisci la tua base di conoscenza personale.",
        steps: [
          {
            title: "Accedere ai Documenti",
            content: "Dalla sidebar, clicca su 'Base di Conoscenza' → 'Documenti'. Vedrai tutti i documenti caricati.",
            actionText: "Vai a Documenti",
            actionHref: "/client/knowledge-documents"
          },
          {
            title: "Caricare un Documento",
            content: "Clicca 'Carica Documento' per uploadare PDF, Word, o file di testo. L'AI indicizzerà automaticamente il contenuto.",
            tips: ["Formati supportati: PDF, DOC, DOCX, TXT", "I documenti sono privati e visibili solo a te"]
          },
          {
            title: "Ricerca nei Documenti",
            content: "Usa la barra di ricerca per trovare contenuti specifici all'interno dei tuoi documenti."
          },
          {
            title: "Uso da parte dell'AI",
            content: "Quando chiedi qualcosa all'AI Assistant, cercherà automaticamente nei tuoi documenti per darti risposte accurate."
          }
        ]
      }
    ]
  },

  clientKnowledgeApis: {
    emoji: "🔌",
    title: "API Esterne",
    path: "/client/knowledge-apis",
    navigation: "Sidebar → Base di Conoscenza → API Esterne",
    description: "Connetti API esterne alla tua knowledge base. Integra dati da altre piattaforme per arricchire le risposte AI.",
    category: "knowledge",
    sections: [
      {
        title: "INTEGRAZIONI API",
        icon: "🔗",
        description: "Collega fonti dati esterne.",
        steps: [
          {
            title: "Accedere alle API",
            content: "Dalla sidebar, clicca su 'Base di Conoscenza' → 'API Esterne'. Vedrai le integrazioni disponibili e attive.",
            actionText: "Vai a API Esterne",
            actionHref: "/client/knowledge-apis"
          },
          {
            title: "API Disponibili",
            content: "Alcune integrazioni potrebbero essere pre-configurate dal tuo consulente: Percorso Capitale (finanze), Google Docs, ecc."
          },
          {
            title: "Aggiungere API",
            content: "Se disponibile, clicca 'Aggiungi API' per collegare una nuova fonte dati. Segui le istruzioni per autenticare."
          }
        ]
      }
    ]
  },

  clientDocumentsAI: {
    emoji: "🔍",
    title: "Documenti AI",
    path: "/client/documents",
    navigation: "Sidebar → Base di Conoscenza → Documenti AI",
    description: "Documenti processati dall'AI con ricerca semantica avanzata. L'AI può cercare e recuperare informazioni in modo intelligente.",
    category: "knowledge",
    sections: [
      {
        title: "DOCUMENTI INDICIZZATI",
        icon: "🧠",
        description: "Documenti con indicizzazione AI avanzata.",
        steps: [
          {
            title: "Accedere ai Documenti AI",
            content: "Dalla sidebar, clicca su 'Base di Conoscenza' → 'Documenti AI'. Vedrai i documenti processati con AI.",
            actionText: "Vai a Documenti AI",
            actionHref: "/client/documents"
          },
          {
            title: "Ricerca Semantica",
            content: "A differenza della ricerca normale, la ricerca AI capisce il significato della tua domanda, non solo le parole chiave."
          },
          {
            title: "File Search",
            content: "L'AI usa tecnologia RAG (Retrieval Augmented Generation) per trovare le informazioni più rilevanti dai tuoi documenti."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 8: IMPOSTAZIONI E FAQ
  // ═══════════════════════════════════════════════════════════════════

  clientSettings: {
    emoji: "⚙️",
    title: "Impostazioni",
    path: "/client/settings",
    navigation: "Sidebar → Icona Ingranaggio (in basso)",
    description: "Le tue impostazioni personali: profilo, notifiche, preferenze, e sicurezza account.",
    category: "impostazioni",
    sections: [
      {
        title: "IMPOSTAZIONI PROFILO",
        icon: "👤",
        description: "Gestisci le tue informazioni personali.",
        steps: [
          {
            title: "Accedere alle Impostazioni",
            content: "Clicca sull'icona ingranaggio in basso nella sidebar, oppure cerca 'Impostazioni' nel menu.",
            actionText: "Vai a Impostazioni",
            actionHref: "/client/settings"
          },
          {
            title: "Dati Personali",
            content: "Modifica: nome, email, foto profilo, numero telefono."
          },
          {
            title: "Notifiche",
            content: "Configura quali notifiche ricevere: email per nuovi esercizi, promemoria consulenze, aggiornamenti corsi."
          },
          {
            title: "Sicurezza",
            content: "Cambia password, abilita autenticazione a due fattori, gestisci sessioni attive."
          }
        ]
      }
    ]
  },

  clientFaq: {
    emoji: "❓",
    title: "FAQ",
    path: "/client/faq",
    navigation: "Sidebar → FAQ",
    description: "Domande frequenti sulla piattaforma. Trova risposte rapide ai dubbi più comuni.",
    category: "impostazioni",
    sections: [
      {
        title: "DOMANDE FREQUENTI",
        icon: "💡",
        description: "Risposte alle domande più comuni.",
        steps: [
          {
            title: "Accedere alle FAQ",
            content: "Cerca 'FAQ' nel menu o accedi direttamente. Le FAQ sono organizzate per categoria.",
            actionText: "Vai a FAQ",
            actionHref: "/client/faq"
          },
          {
            title: "Categorie FAQ",
            content: "Le FAQ coprono: Account e Accesso, Corsi e Formazione, Esercizi, Consulenze, AI Assistant, Problemi Tecnici."
          },
          {
            title: "Ricerca",
            content: "Usa la barra di ricerca per trovare rapidamente risposte a domande specifiche."
          },
          {
            title: "Non trovi risposta?",
            content: "Se non trovi risposta nelle FAQ, usa l'AI Assistant per chiedere aiuto personalizzato.",
            tips: ["L'AI può rispondere a domande che non sono nelle FAQ"]
          }
        ]
      }
    ]
  },

  clientRoadmap: {
    emoji: "🗺️",
    title: "La Mia Roadmap",
    path: "/client/roadmap",
    navigation: "Dashboard → Widget Roadmap",
    description: "La tua roadmap personalizzata. Visualizza il percorso completo, i milestone raggiunti, e i prossimi obiettivi.",
    category: "dashboard",
    sections: [
      {
        title: "LA TUA ROADMAP",
        icon: "🛤️",
        description: "Il percorso che stai seguendo.",
        steps: [
          {
            title: "Accedere alla Roadmap",
            content: "Dalla dashboard, clicca sul widget Roadmap oppure cerca 'Roadmap' nel menu.",
            actionText: "Vai a Roadmap",
            actionHref: "/client/roadmap"
          },
          {
            title: "Struttura",
            content: "La roadmap mostra il tuo percorso diviso in fasi. Ogni fase ha obiettivi specifici e milestone da raggiungere."
          },
          {
            title: "Milestone",
            content: "I milestone sono traguardi importanti: completamento moduli, raggiungimento obiettivi, superamento verifiche."
          },
          {
            title: "Progresso",
            content: "Visualizza quanto hai completato e cosa ti resta da fare per arrivare al traguardo."
          }
        ]
      }
    ]
  }

};

/**
 * Funzione helper per ottenere tutte le guide come array
 */
export function getAllClientGuides(): ClientGuide[] {
  return Object.values(clientGuides);
}

/**
 * Funzione helper per ottenere una guida specifica per path
 */
export function getClientGuideByPath(path: string): ClientGuide | undefined {
  return Object.values(clientGuides).find(guide => guide.path === path);
}

/**
 * Funzione helper per ottenere guide per categoria
 */
export function getClientGuidesByCategory(category: ClientGuide['category']): ClientGuide[] {
  return Object.values(clientGuides).filter(guide => guide.category === category);
}

/**
 * Esporta il contenuto completo come stringa per l'AI
 */
export function getClientGuidesAsText(): string {
  const guides = getAllClientGuides();
  let text = "# GUIDA COMPLETA PIATTAFORMA - AREA CLIENTE\n\n";
  
  guides.forEach(guide => {
    text += `## ${guide.emoji} ${guide.title}\n`;
    text += `**Percorso:** ${guide.navigation}\n`;
    text += `**URL:** ${guide.path}\n`;
    text += `${guide.description}\n\n`;
    
    guide.sections.forEach(section => {
      text += `### ${section.icon} ${section.title}\n`;
      text += `${section.description}\n\n`;
      
      section.steps.forEach(step => {
        text += `**${step.title}**\n`;
        text += `${step.content}\n`;
        if (step.tips && step.tips.length > 0) {
          text += `💡 Tips: ${step.tips.join(", ")}\n`;
        }
        if (step.warnings && step.warnings.length > 0) {
          text += `⚠️ Attenzione: ${step.warnings.join(", ")}\n`;
        }
        text += "\n";
      });
    });
    
    text += "---\n\n";
  });
  
  return text;
}
