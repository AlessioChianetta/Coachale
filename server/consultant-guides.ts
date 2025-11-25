// Consultant Guides - Structured Navigation Help
// Used by AI service to provide context-aware guidance

export interface GuideStep {
  title: string;
  content: string;
  actionText?: string;
  actionHref?: string;
}

export interface GuideSection {
  title: string;
  icon: string; // emoji
  description: string;
  steps: GuideStep[];
}

export interface Guide {
  title: string;
  path: string;
  emoji: string;
  description: string;
  sections: GuideSection[];
}

export interface ConsultantGuides {
  whatsappGuide: Guide;
  emailMarketingGuide: Guide;
  universityGuide: Guide;
  clientManagementGuide: Guide;
  calendarGuide: Guide;
  apiConfigurationGuide: Guide;
}

export const consultantGuides: ConsultantGuides = {
  whatsappGuide: {
    title: "WhatsApp Business",
    path: "/consultant/guide-whatsapp",
    emoji: "🟢",
    description: "Sistema completo per gestire lead e conversazioni WhatsApp con automazione AI",
    sections: [
      {
        title: "CAMPAGNE MARKETING (WhatsApp Lead)",
        icon: "📍",
        description: "Crea e gestisce campagne WhatsApp con uncini personalizzati",
        steps: [
          {
            title: "Vai su 'Campagne Marketing'",
            content: "COMUNICAZIONE & MARKETING → Campagne Marketing (URL: /consultant/campaigns)",
            actionText: "Vai alle Campagne",
            actionHref: "/consultant/campaigns"
          },
          {
            title: "Clicca 'Nuova Campagna'",
            content: "Inserisci nome campagna descrittivo (es: 'Facebook Ads Q1 2025')"
          },
          {
            title: "Configura l'uncino",
            content: "L'uncino è la frase che cattura l'attenzione del lead. Es: 'Automatizza le tue prenotazioni con un QR code'. Sarà usato in tutti i messaggi della campagna."
          },
          {
            title: "Imposta obiettivi e stato ideale",
            content: "Definisci lo stato ideale del lead (es: 'Demo richiesta') e i desideri impliciti (es: 'Ridurre personale in sala')."
          },
          {
            title: "Seleziona template WhatsApp",
            content: "Scegli i template messaggi da usare per apertura e follow-up. Se non selezioni nulla, userà quelli dell'agente predefinito.",
            actionText: "Gestisci Template",
            actionHref: "/consultant/whatsapp/custom-templates/list"
          },
          {
            title: "Metriche disponibili",
            content: "Monitora: Lead totali gestiti, Lead convertiti, Conversion rate (%), Tempo medio di risposta"
          }
        ]
      },
      {
        title: "GESTIONE LEAD",
        icon: "📋",
        description: "Importa, visualizza e gestisce i lead",
        steps: [
          {
            title: "Clicca 'Importa Lead'",
            content: "COMUNICAZIONE & MARKETING → Lead & Campagne (URL: /consultant/proactive-leads)",
            actionText: "Importa Lead",
            actionHref: "/consultant/proactive-leads"
          },
          {
            title: "Carica file CSV",
            content: "Formato colonne richieste: Nome, Cognome, Telefono"
          },
          {
            title: "Seleziona campagna di provenienza",
            content: "Quando selezioni una campagna durante l'import, tutti i lead erediteranno automaticamente uncino, obiettivi e template della campagna."
          },
          {
            title: "Programma quando contattare",
            content: "Scegli quando contattare ogni lead. Per lead 'freddi' aspetta 24h, per lead 'caldi' contatta subito."
          },
          {
            title: "Stati lead",
            content: "🟡 Pending: Non ancora contattato | 🔵 Contacted: Primo messaggio inviato | 🟢 Responded: Lead ha risposto | ✅ Converted: Diventato cliente"
          }
        ]
      },
      {
        title: "AGENTI INTELLIGENTI (WhatsApp AI)",
        icon: "🤖",
        description: "Configura bot AI che rispondono automaticamente su WhatsApp",
        steps: [
          {
            title: "Vai su Agenti Intelligenti",
            content: "COMUNICAZIONE & MARKETING → WhatsApp - Agenti AI (URL: /consultant/ai-agents)",
            actionText: "Configura Agenti",
            actionHref: "/consultant/ai-agents"
          },
          {
            title: "Agenti disponibili",
            content: "Marco setter: Qualifica lead e prenota appuntamenti | Receptionist Principale: Gestisce prima risposta automatica"
          },
          {
            title: "Configura agente",
            content: "1. Imposta nome agente\n2. Collega numero WhatsApp Business (da Twilio)\n3. Definisci orari di lavoro (es: Lun-Ven 9-18)\n4. Imposta uncino e obiettivi predefiniti\n5. Assegna template messaggi (apertura, follow-up)\n6. Abilita/disabilita 'Dry Run' (test)\n7. Attiva invio automatico"
          }
        ]
      },
      {
        title: "TEMPLATE WHATSAPP",
        icon: "✉️",
        description: "Crea template messaggi con variabili dinamiche",
        steps: [
          {
            title: "Vai su Template Messaggi",
            content: "COMUNICAZIONE & MARKETING → WhatsApp - Template Custom (URL: /consultant/whatsapp/custom-templates/list)",
            actionText: "Gestisci Template",
            actionHref: "/consultant/whatsapp/custom-templates/list"
          },
          {
            title: "Clicca 'Nuovo Template'",
            content: "Scegli tipo: apertura, follow-up gentile, follow-up valore, finale"
          },
          {
            title: "Scrivi messaggio con variabili",
            content: "Variabili disponibili:\n- {nome_lead} = nome del contatto\n- {cognome_lead} = cognome\n- {uncino} = uncino della campagna\n- {obiettivi} = obiettivi stato ideale\n- {desideri} = desideri impliciti"
          },
          {
            title: "Preview e salva",
            content: "Usa preview per vedere anteprima con dati reali, poi salva template"
          },
          {
            title: "Assegnazione template",
            content: "Puoi assegnare template specifici a ogni campagna oppure usare template predefiniti dell'agente"
          }
        ]
      },
      {
        title: "IMPOSTAZIONI API (Connessioni Twilio)",
        icon: "⚙️",
        description: "Configura connessioni WhatsApp Business via Twilio",
        steps: [
          {
            title: "Vai su Impostazioni API Esterne",
            content: "CONFIGURAZIONE → API Settings Lead (URL: /consultant/api-settings)",
            actionText: "Configura API",
            actionHref: "/consultant/api-settings"
          },
          {
            title: "Cerca sezione WhatsApp/Twilio",
            content: "Inserisci credenziali da Twilio:\n- Account SID (inizia con AC...)\n- Auth Token (stringa lunga)\n- Numero WhatsApp Business (formato: +39...)"
          },
          {
            title: "Test connessione",
            content: "Clicca 'Test Connessione'. Se test OK, salva configurazione"
          },
          {
            title: "Come ottenere credenziali Twilio",
            content: "1. Vai su twilio.com\n2. Registra account (o accedi)\n3. Dashboard → Account Info → copia SID e Token\n4. Phone Numbers → WhatsApp Sandbox (per test) o numero reale"
          }
        ]
      },
      {
        title: "DRY RUN MODE",
        icon: "🧪",
        description: "Modalità test per verificare messaggi senza inviarli realmente",
        steps: [
          {
            title: "Cos'è il Dry Run",
            content: "Modalità test dove i messaggi vengono simulati ma NON inviati realmente ai lead. Utile per testare template e flussi prima di attivare l'invio reale."
          },
          {
            title: "Attiva Dry Run",
            content: "Nelle impostazioni agente, abilita il toggle 'Dry Run Mode'. Quando attivo, tutti i messaggi saranno solo simulati."
          },
          {
            title: "Verifica simulazioni",
            content: "I messaggi in dry run appaiono nei log ma con indicazione [DRY RUN] e non vengono inviati via Twilio."
          }
        ]
      }
    ]
  },

  emailMarketingGuide: {
    title: "Email Marketing",
    path: "/consultant/guide-email",
    emoji: "📧",
    description: "Sistema di automazione email con SMTP, newsletter e journey automatici",
    sections: [
      {
        title: "CONFIGURAZIONE SMTP",
        icon: "⚙️",
        description: "Come collegare il tuo account email",
        steps: [
          {
            title: "Scegli provider email",
            content: "Puoi usare Gmail, Outlook, o qualsiasi servizio SMTP. Gmail è il più semplice da configurare."
          },
          {
            title: "Ottieni credenziali SMTP",
            content: "Per Gmail: Vai su Impostazioni → Sicurezza → Password per le app. Genera una password dedicata per l'app."
          },
          {
            title: "Inserisci configurazione",
            content: "Vai su CONFIGURAZIONE → Configurazione SMTP (URL: /consultant/smtp-settings) e inserisci: Server (smtp.gmail.com), Porta (587), Email e Password app.",
            actionText: "Configura SMTP",
            actionHref: "/consultant/smtp-settings"
          },
          {
            title: "Testa la connessione",
            content: "Invia un'email di test per verificare che tutto funzioni correttamente. Se ricevi l'email, sei pronto!"
          }
        ]
      },
      {
        title: "JOURNEY TEMPLATES",
        icon: "🗺️",
        description: "Email automatiche per il percorso del cliente",
        steps: [
          {
            title: "Vai su Journey Templates",
            content: "Email Marketing → Journey Templates (URL: /consultant/email-journey)",
            actionText: "Gestisci Journey",
            actionHref: "/consultant/email-journey"
          },
          {
            title: "Crea sequenza email",
            content: "Definisci una serie di email che vengono inviate automaticamente al cliente in base a trigger specifici (es: nuovo cliente, completamento trimestre, inattività)."
          },
          {
            title: "Imposta trigger",
            content: "Configura quando ogni email viene inviata: giorno X dopo iscrizione, dopo completamento esercizio, ogni lunedì mattina, ecc."
          },
          {
            title: "Personalizza contenuto",
            content: "Usa variabili dinamiche {{nome_cliente}}, {{ultimo_obiettivo}}, {{stato_attuale}} per personalizzare ogni email."
          }
        ]
      },
      {
        title: "TASK AUTOMATICI",
        icon: "📋",
        description: "Programma invii email ricorrenti",
        steps: [
          {
            title: "Crea task email",
            content: "Vai su COMUNICAZIONE & MARKETING → Email - Task Automatici (URL: /consultant/tasks). Crea task per inviare email a intervalli regolari.",
            actionText: "Gestisci Task",
            actionHref: "/consultant/tasks"
          },
          {
            title: "Imposta frequenza",
            content: "Scegli ogni quanto inviare: giornaliero, settimanale, o personalizzato. Es: ogni lunedì mattina alle 9:00."
          },
          {
            title: "Seleziona destinatari",
            content: "Scegli quali clienti riceveranno l'email: tutti, solo attivi, o filtrati per tag/stato."
          },
          {
            title: "Monitora invii",
            content: "Ogni invio viene registrato nello Storico Invii dove puoi vedere successi e eventuali errori."
          }
        ]
      },
      {
        title: "PERSONALIZZAZIONE AI",
        icon: "✨",
        description: "Usa AI per email personalizzate",
        steps: [
          {
            title: "Configura API Gemini",
            content: "Vai su CONFIGURAZIONE → Configurazione AI Email (URL: /consultant/ai-config) e inserisci la tua API key di Google Gemini.",
            actionText: "Configura AI",
            actionHref: "/consultant/ai-config"
          },
          {
            title: "Usa variabili dinamiche",
            content: "Nei template email usa {{nome_cliente}}, {{ultimo_obiettivo}}, {{stato_attuale}} per personalizzare."
          },
          {
            title: "Genera contenuti",
            content: "L'AI può generare automaticamente email di follow-up basate sullo stato e progresso del cliente."
          },
          {
            title: "Ottimizza il tono",
            content: "L'AI adatta il tono del messaggio in base alla relazione e al livello di engagement del cliente."
          }
        ]
      },
      {
        title: "STORICO INVII",
        icon: "📥",
        description: "Monitora tutte le email inviate",
        steps: [
          {
            title: "Visualizza log completo",
            content: "Vai su COMUNICAZIONE & MARKETING → Email - Storico Invii (URL: /consultant/email-logs) per vedere tutte le email inviate dal sistema.",
            actionText: "Vedi Storico",
            actionHref: "/consultant/email-logs"
          },
          {
            title: "Filtra per cliente",
            content: "Cerca email inviate a un cliente specifico per vedere tutta la cronologia di comunicazione."
          },
          {
            title: "Verifica stato invio",
            content: "Ogni email mostra se è stata inviata con successo, aperta dal cliente, o se ci sono stati errori."
          },
          {
            title: "Risolvi problemi",
            content: "Se vedi errori frequenti, controlla le credenziali SMTP o i limiti di invio del tuo provider email."
          }
        ]
      }
    ]
  },

  universityGuide: {
    title: "La Mia Università",
    path: "/consultant/guide-university",
    emoji: "🎓",
    description: "Sistema di formazione strutturato con trimestri, moduli, lezioni ed esercizi",
    sections: [
      {
        title: "NAVIGAZIONE CORSI",
        icon: "📚",
        description: "Struttura e organizzazione dei percorsi formativi",
        steps: [
          {
            title: "Vai all'Università",
            content: "FORMAZIONE → La Mia Università (URL: /consultant/university)",
            actionText: "Vai all'Università",
            actionHref: "/consultant/university"
          },
          {
            title: "Struttura a trimestri",
            content: "L'università è divisa in trimestri. Ogni trimestre contiene moduli tematici specifici."
          },
          {
            title: "Moduli e lezioni",
            content: "Ogni modulo contiene lezioni progressive. I clienti devono completarle in ordine per sbloccare le successive."
          },
          {
            title: "Assegna percorsi",
            content: "Puoi assegnare trimestri specifici ai clienti in base al loro livello e obiettivi."
          },
          {
            title: "Monitora progressi",
            content: "Vedi in tempo reale quali clienti hanno completato quali lezioni e a che punto sono del percorso."
          }
        ]
      },
      {
        title: "GESTIONE ESERCIZI",
        icon: "📝",
        description: "Creazione e assegnazione esercizi ai clienti",
        steps: [
          {
            title: "Crea esercizio da template",
            content: "Usa FORMAZIONE → Template Esercizi (URL: /consultant/exercise-templates) per creare rapidamente esercizi standardizzati.",
            actionText: "Vedi Template",
            actionHref: "/consultant/exercise-templates"
          },
          {
            title: "Personalizza per cliente",
            content: "Vai su FORMAZIONE → Esercizi Assegnati (URL: /consultant/exercises). Personalizza domande, durata e criteri di valutazione.",
            actionText: "Crea Esercizio",
            actionHref: "/consultant/exercises"
          },
          {
            title: "Imposta scadenze",
            content: "Assegna una data di scadenza per mantenere il cliente focalizzato e motivato."
          },
          {
            title: "Valuta e fornisci feedback",
            content: "Quando il cliente invia l'esercizio, valutalo e fornisci feedback dettagliato per la crescita."
          }
        ]
      },
      {
        title: "TRACCIAMENTO PROGRESSI",
        icon: "📊",
        description: "Monitora evoluzione e metriche dei clienti",
        steps: [
          {
            title: "Dashboard progressi",
            content: "Ogni cliente ha una dashboard che mostra: lezioni completate, esercizi fatti, voti ottenuti, streak giorni."
          },
          {
            title: "Sistema a livelli",
            content: "I clienti guadagnano punti esperienza completando lezioni ed esercizi. Avanzano di livello: Studente → Esperto → Mentor → Master."
          },
          {
            title: "Streak e gamification",
            content: "Traccia quanti giorni consecutivi il cliente è attivo. Gli streak mantengono l'engagement alto."
          },
          {
            title: "Report periodici",
            content: "Genera report mensili automatici sui progressi del cliente da condividere nelle consulenze."
          }
        ]
      },
      {
        title: "CERTIFICATI E BADGE",
        icon: "🏆",
        description: "Sistema di riconoscimenti per traguardi raggiunti",
        steps: [
          {
            title: "Certificati automatici",
            content: "Quando un cliente completa un trimestre, genera automaticamente un certificato PDF personalizzato."
          },
          {
            title: "Badge per obiettivi",
            content: "Assegna badge quando il cliente raggiunge milestone specifici: 10 esercizi completati, 30 giorni di streak, ecc."
          },
          {
            title: "Showcase achievements",
            content: "I clienti possono vedere tutti i loro certificati e badge nella loro area personale."
          },
          {
            title: "Motivazione continua",
            content: "Usa certificati e badge come sistema di ricompensa per mantenere alta la motivazione."
          }
        ]
      }
    ]
  },

  clientManagementGuide: {
    title: "Gestione Clienti",
    path: "/consultant/guide-clients",
    emoji: "👥",
    description: "Anagrafica completa, stato clienti, task, documenti e metriche performance",
    sections: [
      {
        title: "ANAGRAFICA CLIENTI",
        icon: "📇",
        description: "Gestione dati e informazioni dei clienti",
        steps: [
          {
            title: "Aggiungi nuovo cliente",
            content: "Vai su GESTIONE CLIENTI → Lista Clienti (URL: /consultant/clients). Inserisci nome, email, telefono e altre informazioni di base.",
            actionText: "Gestisci Clienti",
            actionHref: "/consultant/clients"
          },
          {
            title: "Profilo completo",
            content: "Ogni cliente ha un profilo con: dati anagrafici, stato attuale, obiettivi, storico consulenze, esercizi assegnati."
          },
          {
            title: "Tag e categorizzazione",
            content: "Usa tag per organizzare i clienti: VIP, Attivo, In pausa, Nuovo, ecc. Facilita filtri e ricerche."
          },
          {
            title: "Note e cronologia",
            content: "Tieni traccia di tutte le interazioni, note importanti e decisioni prese durante le consulenze."
          }
        ]
      },
      {
        title: "TRACCIAMENTO STATO",
        icon: "🎯",
        description: "Monitora l'evoluzione del cliente",
        steps: [
          {
            title: "Definisci stato attuale",
            content: "Vai su GESTIONE CLIENTI → Stato & Obiettivi (URL: /consultant/client-state). Descrivi dove si trova ora il cliente (es: 'Fatturato 50k/anno, stress alto').",
            actionText: "Gestisci Stati",
            actionHref: "/consultant/client-state"
          },
          {
            title: "Imposta stato ideale",
            content: "Definisci dove vuole arrivare (es: 'Fatturato 100k/anno, work-life balance')."
          },
          {
            title: "Identifica ostacoli",
            content: "Documenta gli ostacoli principali che impediscono al cliente di raggiungere lo stato ideale."
          },
          {
            title: "Aggiorna regolarmente",
            content: "Rivedi e aggiorna lo stato dopo ogni consulenza per tracciare i progressi effettivi."
          }
        ]
      },
      {
        title: "TASK E FEEDBACK",
        icon: "✅",
        description: "Assegna compiti e raccogli riflessioni giornaliere",
        steps: [
          {
            title: "Crea task post-consulenza",
            content: "Vai su GESTIONE CLIENTI → Task & Feedback (URL: /consultant/client-daily). Crea task specifici da completare prima della prossima consulenza.",
            actionText: "Gestisci Task",
            actionHref: "/consultant/client-daily"
          },
          {
            title: "Imposta priorità",
            content: "Classifica task come: Urgente, Alta, Media, Bassa. Il cliente vedrà la lista ordinata per priorità."
          },
          {
            title: "Raccogli riflessioni giornaliere",
            content: "Il cliente può inserire riflessioni giornaliere: 3 cose per cui è grato, obiettivi del giorno, cosa migliorare."
          },
          {
            title: "Monitora completion rate",
            content: "Vedi quanti task il cliente completa per capire il livello di engagement e commitment."
          }
        ]
      },
      {
        title: "PROGRAMMAZIONE APPUNTAMENTI",
        icon: "📅",
        description: "Gestione consulenze e calendario",
        steps: [
          {
            title: "Crea appuntamento",
            content: "Vai su GESTIONE CLIENTI → Appuntamenti (URL: /consultant/appointments). Programma data, ora, durata e tipo di consulenza.",
            actionText: "Vedi Appuntamenti",
            actionHref: "/consultant/appointments"
          },
          {
            title: "Integrazione Google Calendar",
            content: "Gli appuntamenti si sincronizzano automaticamente con Google Calendar se hai collegato il tuo account."
          },
          {
            title: "Note pre-consulenza",
            content: "Prepara note e punti da discutere prima della consulenza per massimizzare l'efficacia."
          },
          {
            title: "Riepilogo post-consulenza",
            content: "Dopo la consulenza, genera un riepilogo automatico con AI da inviare al cliente via email."
          }
        ]
      },
      {
        title: "METRICHE PERFORMANCE",
        icon: "📈",
        description: "Misura risultati e progressi dei clienti",
        steps: [
          {
            title: "Dashboard metriche",
            content: "Ogni cliente ha metriche chiave: completion rate esercizi, streak giorni attivo, progressi università."
          },
          {
            title: "Confronta periodi",
            content: "Visualizza grafici che mostrano evoluzione nel tempo: questo mese vs mese scorso, trimestre attuale vs precedente."
          },
          {
            title: "Identifica pattern",
            content: "Cerca correlazioni: i clienti con streak più alto hanno anche completion rate più alto?"
          },
          {
            title: "Report automatici",
            content: "Genera report mensili/trimestrali da condividere con il cliente per mostrare progressi tangibili."
          }
        ]
      },
      {
        title: "ROADMAP PERSONALIZZATA",
        icon: "🗺️",
        description: "Crea percorsi di crescita su misura",
        steps: [
          {
            title: "Visualizza roadmap",
            content: "Ogni cliente ha una roadmap Orbitale (URL: /consultant/client-roadmap) con fasi, gruppi e item da completare in 6-12 mesi.",
            actionText: "Vedi Roadmap",
            actionHref: "/consultant/client-roadmap"
          },
          {
            title: "Segna progressi",
            content: "Man mano che il cliente completa item della roadmap, segnali come completati con eventuali voti."
          },
          {
            title: "Aggiungi note",
            content: "Per ogni item completato, aggiungi note su cosa è andato bene e cosa migliorare."
          },
          {
            title: "Celebra milestone",
            content: "Quando il cliente completa una fase intera, celebra il successo e pianifica la fase successiva."
          }
        ]
      }
    ]
  },

  calendarGuide: {
    title: "Google Calendar",
    path: "/consultant/guide-calendar",
    emoji: "📅",
    description: "Sincronizzazione bidirezionale, gestione disponibilità e programmazione appuntamenti",
    sections: [
      {
        title: "COLLEGAMENTO ACCOUNT GOOGLE",
        icon: "🔗",
        description: "Come connettere Google Calendar",
        steps: [
          {
            title: "Vai alle impostazioni",
            content: "Vai su Google Calendar → Impostazioni Calendar (URL: /consultant/calendar-settings) per iniziare la connessione.",
            actionText: "Configura Calendar",
            actionHref: "/consultant/calendar-settings"
          },
          {
            title: "Autorizza accesso",
            content: "Clicca 'Collega Google Calendar' e autorizza l'app ad accedere al tuo calendario. Usiamo OAuth2 sicuro."
          },
          {
            title: "Seleziona calendario",
            content: "Scegli quale calendario usare per le consulenze. Puoi usare il calendario principale o crearne uno dedicato."
          },
          {
            title: "Verifica connessione",
            content: "Il sistema mostrerà un segno verde quando la connessione è attiva e funzionante."
          }
        ]
      },
      {
        title: "SINCRONIZZAZIONE EVENTI",
        icon: "🔄",
        description: "Sincronizzazione automatica bidirezionale",
        steps: [
          {
            title: "Sincronizzazione bidirezionale",
            content: "Gli eventi si sincronizzano in entrambe le direzioni: Google Calendar ↔ Piattaforma."
          },
          {
            title: "Aggiornamenti in tempo reale",
            content: "Se modifichi un appuntamento su Google Calendar, i cambiamenti appaiono istantaneamente nella piattaforma e viceversa."
          },
          {
            title: "Risoluzione conflitti",
            content: "Se ci sono sovrapposizioni, il sistema ti avvisa e ti permette di risolvere manualmente il conflitto."
          },
          {
            title: "Sync on-demand",
            content: "Puoi forzare una sincronizzazione manuale in qualsiasi momento dalle Impostazioni Calendar."
          }
        ]
      },
      {
        title: "GESTIONE DISPONIBILITÀ",
        icon: "⏰",
        description: "Imposta quando sei disponibile per consulenze",
        steps: [
          {
            title: "Orari di lavoro",
            content: "Imposta i tuoi orari di lavoro predefiniti: es. Lun-Ven 9:00-18:00. Gli appuntamenti fuori orario verranno evidenziati."
          },
          {
            title: "Giorni non disponibili",
            content: "Blocca giorni specifici per ferie, eventi personali o formazione."
          },
          {
            title: "Buffer tra appuntamenti",
            content: "Imposta un buffer (es: 15 minuti) tra appuntamenti consecutivi per prepararti e fare pausa."
          },
          {
            title: "Slot personalizzati",
            content: "Definisci slot di disponibilità personalizzati per giorni specifici (es: martedì mattina solo per nuovi clienti)."
          }
        ]
      },
      {
        title: "PROGRAMMAZIONE CONSULENZE",
        icon: "📆",
        description: "Come programmare appuntamenti con i clienti",
        steps: [
          {
            title: "Crea appuntamento",
            content: "Dal calendario (URL: /consultant/calendar), clicca su uno slot libero e seleziona il cliente. Imposta durata (30min, 1h, 2h).",
            actionText: "Vai al Calendario",
            actionHref: "/consultant/calendar"
          },
          {
            title: "Aggiungi Google Meet",
            content: "Il sistema crea automaticamente un link Google Meet per videochiamate se hai abilitato l'opzione."
          },
          {
            title: "Notifiche automatiche",
            content: "I clienti ricevono automaticamente email di conferma con data, ora e link Meet."
          },
          {
            title: "Promemoria",
            content: "Entrambi ricevete promemoria 24h e 1h prima dell'appuntamento per ridurre no-show."
          }
        ]
      },
      {
        title: "VISUALIZZAZIONE CALENDARIO",
        icon: "📊",
        description: "Navigazione e uso del calendario",
        steps: [
          {
            title: "Viste multiple",
            content: "Passa tra vista Giorno, Settimana, Mese per vedere il tuo planning a diversi livelli di dettaglio."
          },
          {
            title: "Filtri per tipo",
            content: "Filtra appuntamenti per tipo: Consulenza iniziale, Follow-up, Sessione strategica, ecc."
          },
          {
            title: "Colori per cliente",
            content: "Ogni cliente ha un colore dedicato per identificare rapidamente i suoi appuntamenti nel calendario."
          },
          {
            title: "Riepilogo giornaliero",
            content: "Ogni mattina vedi un riepilogo degli appuntamenti della giornata con nomi clienti e note preparatorie."
          }
        ]
      },
      {
        title: "INTEGRAZIONE EMAIL",
        icon: "✉️",
        description: "Automazioni email legate al calendario",
        steps: [
          {
            title: "Email conferma automatica",
            content: "Quando crei un appuntamento, il cliente riceve automaticamente email di conferma con tutti i dettagli."
          },
          {
            title: "Reminder pre-consulenza",
            content: "24h prima, entrambi ricevete promemoria con link Meet e punti da discutere preparati."
          },
          {
            title: "Follow-up post-consulenza",
            content: "Dopo la consulenza, puoi inviare automaticamente riepilogo e prossimi step via email."
          },
          {
            title: "Rescheduling facile",
            content: "Se devi spostare un appuntamento, il sistema invia automaticamente notifica al cliente con nuova data."
          }
        ]
      }
    ]
  },

  apiConfigurationGuide: {
    title: "Configurazione API",
    path: "/consultant/api-keys-unified",
    emoji: "🔑",
    description: "Gestione centralizzata di tutte le API: Vertex AI, Google AI Studio, Email SMTP, WhatsApp, Lead Import",
    sections: [
      {
        title: "VERTEX AI (CONSIGLIATO - ENTERPRISE)",
        icon: "☁️",
        description: "AI provider principale di Google Cloud con $300 crediti gratuiti per 90 giorni",
        steps: [
          {
            title: "Vai su Impostazioni API",
            content: "CONFIGURAZIONE → Impostazioni API (URL: /consultant/api-keys-unified). Seleziona tab 'AI (Gemini)'.",
            actionText: "Configura API",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Crea progetto Google Cloud",
            content: "1. Vai su console.cloud.google.com\n2. Crea nuovo progetto o seleziona esistente\n3. Abilita 'Vertex AI API' dalla sezione API & Services\n4. Copia Project ID (es: 'my-ai-project-123')"
          },
          {
            title: "Configura Service Account",
            content: "1. IAM & Admin → Service Accounts → Create Service Account\n2. Assegna ruolo 'Vertex AI User'\n3. Create Key → JSON → Download file JSON\n4. Copia contenuto JSON completo nel campo 'Service Account JSON'"
          },
          {
            title: "Imposta Location",
            content: "Scegli regione geografica (default: us-central1). Altre opzioni: europe-west1, asia-southeast1. La location deve supportare Gemini."
          },
          {
            title: "Differenze con Google AI Studio",
            content: "🟢 Vertex AI: $300 crediti gratuiti 90 giorni, enterprise-grade, rate limits alti, SLA garantiti\n🟡 Google Studio: Gratuito sempre, rate limits bassi (15 req/min), per prototipazione"
          },
          {
            title: "Alert scadenza crediti",
            content: "⚠️ I $300 crediti Vertex AI scadono dopo 90 giorni. Il sistema mostra alert giallo 15 giorni prima della scadenza. Dopo scadenza, passa a Google AI Studio automaticamente o configura fatturazione Google Cloud."
          },
          {
            title: "Salva e testa",
            content: "Clicca 'Salva Modifiche'. Il badge 'AI Attivo' in alto mostrerà pallino verde se Vertex AI funziona correttamente."
          }
        ]
      },
      {
        title: "GOOGLE AI STUDIO (FALLBACK GRATUITO)",
        icon: "✨",
        description: "API Keys gratuite Google Gemini per sviluppo e test",
        steps: [
          {
            title: "Vai su tab AI (Gemini)",
            content: "CONFIGURAZIONE → Impostazioni API (URL: /consultant/api-keys-unified). Scorri fino a 'Google AI Studio API Keys (Fallback)'.",
            actionText: "Configura API",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Ottieni API Key gratuita",
            content: "1. Vai su aistudio.google.com\n2. Clicca 'Get API Key' → Create API Key\n3. Copia la chiave (inizia con 'AIza...')\n4. Incollala nel campo e clicca 'Aggiungi API Key'"
          },
          {
            title: "Rotazione automatica",
            content: "Puoi aggiungere fino a 10 API keys. Il sistema le ruota automaticamente ad ogni richiesta per distribuire il carico e rispettare i rate limits (15 req/min per key)."
          },
          {
            title: "Quando viene usato",
            content: "Google AI Studio viene usato automaticamente come fallback se:\n- Vertex AI non è configurato\n- Vertex AI fallisce (credenziali errate, crediti esauriti)\n- Il cliente ha configurato 'google_studio' come provider preferito"
          },
          {
            title: "Limiti gratuiti",
            content: "⚠️ Limiti Google AI Studio: 15 richieste/minuto, 1500 richieste/giorno. Per uso intensivo, usa Vertex AI."
          }
        ]
      },
      {
        title: "API CLIENTI (PROVIDER PER CLIENTE)",
        icon: "👥",
        description: "Configura quale AI provider usare per ogni cliente specifico",
        steps: [
          {
            title: "Vai su tab API Clienti",
            content: "CONFIGURAZIONE → Impostazioni API (URL: /consultant/api-keys-unified). Seleziona tab 'API Clienti'.",
            actionText: "Configura Clienti",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Scegli provider per cliente",
            content: "Per ogni cliente puoi scegliere:\n🟢 Vertex AI (predefinito): usa le tue credenziali Vertex AI\n🟡 Google Studio: usa le tue API keys Google AI Studio\n🟣 Custom: usa API keys specifiche del cliente (fino a 10 con rotazione)"
          },
          {
            title: "Configura Custom API Keys",
            content: "Se selezioni 'Custom', puoi:\n1. Clicca 'Aggiungi' per inserire API keys specifiche\n2. Aggiungi fino a 10 keys che verranno ruotate automaticamente\n3. Le keys vengono usate SOLO per quel cliente specifico"
          },
          {
            title: "Salva configurazione",
            content: "Dopo aver selezionato provider e (opzionale) custom keys, clicca 'Salva'. La configurazione è attiva immediatamente."
          },
          {
            title: "Quando usare Custom",
            content: "Usa 'Custom' quando:\n- Il cliente fornisce proprie API keys\n- Vuoi separare il billing per cliente\n- Il cliente ha rate limits personalizzati"
          }
        ]
      },
      {
        title: "EMAIL SMTP",
        icon: "📧",
        description: "Configura server SMTP per invio email automatiche",
        steps: [
          {
            title: "Vai su tab Email SMTP",
            content: "CONFIGURAZIONE → Impostazioni API (URL: /consultant/api-keys-unified). Seleziona tab 'Email SMTP'.",
            actionText: "Configura SMTP",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Configura Gmail (più semplice)",
            content: "1. Host: smtp.gmail.com\n2. Porta: 587\n3. Email: tua-email@gmail.com\n4. Password: Genera 'App Password' da Google Account Security\n5. From Email/Name: come appariranno le tue email"
          },
          {
            title: "Provider SMTP alternativi",
            content: "Outlook: smtp-mail.outlook.com (587)\nYahoo: smtp.mail.yahoo.com (587)\nSendGrid/Mailgun: per volumi elevati"
          },
          {
            title: "Personalizza tono e firma",
            content: "Scegli tono email (professionale/amichevole/motivazionale) e aggiungi firma personalizzata che apparirà in tutte le email automatiche."
          }
        ]
      },
      {
        title: "WHATSAPP (TWILIO)",
        icon: "💬",
        description: "Configura WhatsApp Business via Twilio",
        steps: [
          {
            title: "Vai su tab WhatsApp",
            content: "CONFIGURAZIONE → Impostazioni API (URL: /consultant/api-keys-unified). Seleziona tab 'WhatsApp'.",
            actionText: "Configura WhatsApp",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Crea account Twilio",
            content: "1. Vai su twilio.com e registrati\n2. Dashboard → Account Info → copia Account SID e Auth Token\n3. Phone Numbers → Buy a Number (WhatsApp enabled)"
          },
          {
            title: "Inserisci credenziali",
            content: "1. Account SID (inizia con 'AC...')\n2. Auth Token (stringa lunga segreta)\n3. WhatsApp Number (formato: +39...)\n4. Clicca 'Salva Modifiche'"
          },
          {
            title: "Test connessione",
            content: "Dopo aver salvato, vai su WhatsApp → Agenti AI e configura il primo agente per testare l'invio messaggi."
          }
        ]
      },
      {
        title: "LEAD IMPORT (API ESTERNE)",
        icon: "📥",
        description: "Configura importazione automatica lead da fonti esterne",
        steps: [
          {
            title: "Vai su tab Lead Import",
            content: "CONFIGURAZIONE → Impostazioni API (URL: /consultant/api-keys-unified). Seleziona tab 'Lead Import'.",
            actionText: "Configura Import",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Crea configurazione polling",
            content: "1. Nome config (es: 'Facebook Ads Lead')\n2. URL endpoint API esterna\n3. Metodo: GET/POST\n4. Headers autenticazione (API Key, Bearer Token, ecc)\n5. Campo mapping (quale campo JSON contiene nome, email, telefono)"
          },
          {
            title: "Imposta schedule polling",
            content: "Scegli frequenza polling:\n- Ogni 5 minuti (lead caldi)\n- Ogni ora (lead tiepidi)\n- Personalizzato con cron expression"
          },
          {
            title: "Assegna campagna",
            content: "Collega la configurazione import a una campagna WhatsApp. I lead importati erediteranno automaticamente uncino, obiettivi e template."
          }
        ]
      },
      {
        title: "INDICATORI PROVIDER ATTIVO",
        icon: "🎯",
        description: "Come vedere quale AI provider è in uso",
        steps: [
          {
            title: "Badge AI Attivo (header)",
            content: "Nella pagina Impostazioni API, in alto a destra vedrai un badge:\n🟢 Pallino verde = Vertex AI attivo\n🟡 Pallino giallo = Google AI Studio fallback"
          },
          {
            title: "Badge aggiornamento automatico",
            content: "Il badge si aggiorna ogni 30 secondi per mostrare sempre lo stato reale del sistema AI."
          },
          {
            title: "Badge nell'AI Assistant",
            content: "Anche l'AI Assistant Consultant mostra un badge indicatore del provider attivo nell'empty state (quando non ci sono conversazioni)."
          },
          {
            title: "Verifica fallback funziona",
            content: "Se Vertex AI fallisce, il badge diventa giallo automaticamente e il sistema usa Google AI Studio come fallback trasparente."
          }
        ]
      }
    ]
  }
};

// Helper function to format guides for AI prompt
export function formatGuidesForPrompt(guides: ConsultantGuides): string {
  let formattedText = `📚 GUIDE NAVIGAZIONE UI - DOVE TROVARE LE COSE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;

  Object.values(guides).forEach((guide) => {
    formattedText += `${guide.emoji} ${guide.title.toUpperCase()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📍 URL: ${guide.path}
📋 Descrizione: ${guide.description}

`;

    guide.sections.forEach((section) => {
      formattedText += `${section.icon} ${section.title}
${section.description}

`;
      
      section.steps.forEach((step, idx) => {
        formattedText += `${idx + 1}. ${step.title}\n`;
        formattedText += `   ${step.content}\n`;
        if (step.actionText && step.actionHref) {
          formattedText += `   → ${step.actionText}: ${step.actionHref}\n`;
        }
        formattedText += `\n`;
      });

      formattedText += `\n`;
    });

    formattedText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
  });

  return formattedText;
}
