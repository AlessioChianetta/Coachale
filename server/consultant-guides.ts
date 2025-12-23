/**
 * GUIDA COMPLETA PIATTAFORMA CONSULENTE
 * 
 * Questa guida documenta OGNI pagina e funzionalità della piattaforma.
 * Viene usata da:
 * 1. AI Assistant - come contesto per rispondere alle domande
 * 2. File Search - sincronizzata automaticamente per tutti i consulenti
 * 
 * STRUTTURA:
 * - Ogni pagina ha: emoji, titolo, path, descrizione, sezioni con steps
 * - Sezione speciale ONBOARDING per tracciare setup wizard
 * 
 * ULTIMO AGGIORNAMENTO: Dicembre 2024
 */

export interface GuideStep {
  title: string;
  content: string;
  actionText?: string;
  actionHref?: string;
  tips?: string[];
  warnings?: string[];
}

export interface GuideSection {
  title: string;
  icon: string;
  description: string;
  steps: GuideStep[];
}

export interface Guide {
  emoji: string;
  title: string;
  path: string;
  description: string;
  category: 'onboarding' | 'core' | 'clients' | 'communication' | 'automation' | 'content' | 'analytics' | 'settings';
  sections: GuideSection[];
}

export interface ConsultantGuides {
  [key: string]: Guide;
}

export const consultantGuides: ConsultantGuides = {

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 1: ONBOARDING - Setup Wizard e Configurazione Iniziale
  // ═══════════════════════════════════════════════════════════════════

  setupWizard: {
    emoji: "🚀",
    title: "Setup Wizard - Configurazione Iniziale",
    path: "/consultant/setup-wizard",
    description: "Il percorso guidato in 4 fasi per configurare completamente la piattaforma. Ogni fase sblocca funzionalità avanzate.",
    category: "onboarding",
    sections: [
      {
        title: "PANORAMICA SETUP WIZARD",
        icon: "🎯",
        description: "Il Setup Wizard ti guida attraverso 4 fasi per configurare la piattaforma. Ogni fase ha step obbligatori e opzionali.",
        steps: [
          {
            title: "Come Funziona il Wizard",
            content: "Il wizard traccia automaticamente i tuoi progressi. Ogni step può avere 4 stati: pending (da fare), configured (configurato), verified (testato), error (problema), skipped (saltato)."
          },
          {
            title: "Accedere al Wizard",
            content: "Vai su /consultant/setup-wizard oppure clicca 'Completa Configurazione' dalla dashboard principale.",
            actionText: "Apri Setup Wizard",
            actionHref: "/consultant/setup-wizard"
          },
          {
            title: "Progressi Salvati",
            content: "I tuoi progressi sono salvati automaticamente. Puoi uscire e riprendere in qualsiasi momento."
          }
        ]
      },
      {
        title: "FASE 1: INFRASTRUTTURA BASE + WHATSAPP",
        icon: "🔧",
        description: "Configurazione delle integrazioni tecniche di base, WhatsApp/Twilio e la prima campagna. Questa fase è ESSENZIALE per iniziare a contattare i lead.",
        steps: [
          {
            title: "1.1 Vertex AI (Obbligatorio)",
            content: "Configura l'intelligenza artificiale che alimenta l'assistente AI, la generazione email e l'analisi clienti. Vai su Impostazioni → API Esterne → Google Vertex AI.",
            actionText: "Configura Vertex AI",
            actionHref: "/consultant/api-keys-unified?tab=ai",
            tips: ["Richiede un progetto Google Cloud con Vertex AI abilitato", "Scarica il file JSON delle credenziali service account"],
            warnings: ["Senza Vertex AI, l'assistente AI e molte funzionalità non funzioneranno"]
          },
          {
            title: "1.2 SMTP Email (Obbligatorio)",
            content: "Configura il server email per inviare email ai clienti, email di follow-up dopo le consulenze e il journey email automatico.",
            actionText: "Configura SMTP",
            actionHref: "/consultant/api-keys-unified?tab=email",
            tips: ["Puoi usare Gmail, Outlook, o qualsiasi provider SMTP", "Per Gmail: abilita 'App Password' nelle impostazioni sicurezza Google"],
            warnings: ["Senza SMTP non puoi inviare email ai clienti"]
          },
          {
            title: "1.3 Google Calendar (Opzionale)",
            content: "Collega Google Calendar ai tuoi agenti WhatsApp per sincronizzare automaticamente gli appuntamenti prenotati.",
            actionText: "Vai agli Agenti",
            actionHref: "/consultant/whatsapp",
            tips: ["Ogni agente può avere il proprio Google Calendar", "Collega il calendario dal pannello laterale dell'agente"]
          },
          {
            title: "1.4 Configurazione Twilio + WhatsApp (Obbligatorio per WhatsApp)",
            content: "Configura Twilio per abilitare l'invio e ricezione di messaggi WhatsApp. Necessario per usare gli agenti AI e le campagne marketing.",
            actionText: "Configura Twilio",
            actionHref: "/consultant/api-keys-unified?tab=twilio",
            tips: ["Crea account su twilio.com", "Richiedi WhatsApp Business API", "Inserisci Account SID, Auth Token e numero WhatsApp"],
            warnings: ["Processo di approvazione Meta può richiedere alcuni giorni", "Senza Twilio non puoi usare WhatsApp"]
          },
          {
            title: "1.5 Template WhatsApp Approvato (ESSENZIALE)",
            content: "Crea e fai approvare almeno un template WhatsApp da Twilio. I template sono OBBLIGATORI per inviare messaggi proattivi ai lead. Twilio deve approvare i template prima che possano essere usati.",
            actionText: "Crea Template",
            actionHref: "/consultant/whatsapp-templates",
            tips: ["Crea un template con categoria 'Primo Contatto' o 'Setter'", "Usa variabili come {{1}} per personalizzare i messaggi", "L'approvazione Twilio richiede da pochi minuti a 24 ore"],
            warnings: ["SENZA TEMPLATE APPROVATO non puoi inviare messaggi proattivi", "I template rifiutati devono essere corretti e ri-sottomessi"]
          },
          {
            title: "1.6 Crea la tua Prima Campagna (ESSENZIALE)",
            content: "Configura la tua prima campagna marketing usando il wizard a 3 step. La campagna collega: Fonti Lead → Template WhatsApp → Agente AI.",
            actionText: "Crea Campagna",
            actionHref: "/consultant/campaigns",
            tips: ["Scegli un nome descrittivo per la campagna", "Seleziona l'agente WhatsApp che gestirà le conversazioni", "Scegli il template approvato per il primo messaggio", "Definisci l'uncino e la descrizione per personalizzare i messaggi"],
            warnings: ["Richiede almeno un template approvato", "L'agente deve avere Twilio configurato"]
          }
        ]
      },
      {
        title: "FASE 2: AGENTI WHATSAPP AVANZATI",
        icon: "🤖",
        description: "Creazione di agenti AI specializzati per diversi tipi di conversazioni WhatsApp.",
        steps: [
          {
            title: "2.1 Agente Inbound",
            content: "L'agente Inbound risponde automaticamente ai lead che ti contattano. Gestisce domande frequenti, qualifica i lead e può prenotare appuntamenti.",
            actionText: "Crea Agente Inbound",
            actionHref: "/consultant/whatsapp/agent/new?type=inbound",
            tips: ["Ideale per rispondere 24/7 senza intervento manuale", "Personalizza il tono e le risposte"],
            warnings: ["Richiede Twilio configurato"]
          },
          {
            title: "2.2 Agente Outbound",
            content: "L'agente Outbound contatta proattivamente i lead delle tue campagne. Segue script personalizzati per qualificare e convertire.",
            actionText: "Crea Agente Outbound",
            actionHref: "/consultant/whatsapp/agent/new?type=outbound",
            tips: ["Usalo con le campagne marketing", "Definisci 'uncini' per catturare l'attenzione"]
          },
          {
            title: "2.3 Agente Consulenziale",
            content: "L'agente Consultivo assiste durante le sessioni con i clienti. Può rispondere a domande tecniche usando la knowledge base.",
            actionText: "Crea Agente Consultivo",
            actionHref: "/consultant/whatsapp/agent/new?type=consultative",
            tips: ["Collega alla Knowledge Base per risposte accurate", "Utile per supporto post-consulenza"]
          },
          {
            title: "2.4 Link Pubblico Agente",
            content: "Una volta creato un agente, genera un link pubblico che i potenziali clienti possono usare per iniziare una conversazione con il tuo bot.",
            actionText: "Gestisci Agenti",
            actionHref: "/consultant/whatsapp-agents-chat",
            tips: ["Il link può essere condiviso su social, sito web, biglietti da visita", "Il lead viene automaticamente aggiunto alla pipeline"]
          },
          {
            title: "2.5 Idee AI Generate",
            content: "L'AI può generare idee creative per i tuoi agenti basandosi sul tuo settore e target.",
            actionText: "Genera Idee",
            actionHref: "/consultant/whatsapp?tab=ideas",
            tips: ["Descrivi il tuo target e l'AI suggerirà contenuti", "Puoi modificare e personalizzare i suggerimenti"]
          },
          {
            title: "2.6 Altri Template WhatsApp",
            content: "Crea template aggiuntivi per follow-up, promemoria appuntamenti, e altre comunicazioni automatiche.",
            actionText: "Gestisci Template",
            actionHref: "/consultant/whatsapp-templates",
            tips: ["Usa categorie diverse: Follow-up, Appuntamenti, Generale", "Ogni template deve essere approvato da Twilio"]
          }
        ]
      },
      {
        title: "FASE 3: CONTENUTI",
        icon: "📚",
        description: "Creazione dei contenuti formativi per i tuoi clienti.",
        steps: [
          {
            title: "3.1 Primo Corso",
            content: "Crea il tuo primo corso formativo per i clienti. Struttura in moduli e lezioni con video, testo e quiz.",
            actionText: "Crea Corso",
            actionHref: "/consultant/university",
            tips: ["I clienti possono seguire i corsi dalla loro area", "Traccia i progressi e il completamento"]
          },
          {
            title: "3.2 Primo Esercizio",
            content: "Crea esercizi pratici che i clienti devono completare. Ricevi notifiche quando vengono consegnati per la revisione.",
            actionText: "Crea Esercizio",
            actionHref: "/consultant/exercise-templates",
            tips: ["Gli esercizi aiutano i clienti ad applicare quanto appreso", "Puoi impostare scadenze e priorità"]
          },
          {
            title: "3.3 Base di Conoscenza",
            content: "Carica documenti, PDF, e contenuti che l'AI userà per rispondere alle domande. Più informazioni carichi, più accurate saranno le risposte.",
            actionText: "Gestisci Knowledge Base",
            actionHref: "/consultant/knowledge-documents",
            tips: ["Carica PDF, documenti Word, o testo", "L'AI indicizza automaticamente i contenuti", "Usato sia dall'assistente che dagli agenti WhatsApp"]
          }
        ]
      },
      {
        title: "FASE 4: AVANZATO",
        icon: "⚡",
        description: "Funzionalità avanzate per ottimizzare e automatizzare il tuo business.",
        steps: [
          {
            title: "4.1 Prima Email Riassuntiva",
            content: "Dopo una consulenza, genera automaticamente un'email di riepilogo con i punti chiave discussi e i prossimi passi.",
            actionText: "Vedi Consulenze",
            actionHref: "/consultant/appointments",
            tips: ["L'AI genera la bozza basandosi sulle note della consulenza", "Puoi modificare prima di inviare"]
          },
          {
            title: "4.2 Video Meeting (TURN)",
            content: "Configura Metered.ca per videochiamate WebRTC affidabili con i tuoi clienti.",
            actionText: "Configura Video",
            actionHref: "/consultant/api-keys-unified?tab=video-meeting",
            tips: ["I link Meet vengono generati automaticamente per le consulenze", "Integrazione con Fathom per trascrizioni automatiche"]
          },
          {
            title: "4.3 Import Lead Automatico",
            content: "Configura API esterne per importare lead automaticamente da altre piattaforme nel sistema.",
            actionText: "Configura Import",
            actionHref: "/consultant/api-keys-unified?tab=lead-import",
            tips: ["Connetti fonti come Facebook Ads, Google Ads, landing page"]
          }
        ]
      },
      {
        title: "VERIFICA COMPLETAMENTO",
        icon: "✅",
        description: "Come verificare che la configurazione sia completa e funzionante.",
        steps: [
          {
            title: "Indicatori di Stato",
            content: "Ogni step nel wizard mostra un indicatore: ✅ Verde = Completato, 🟡 Giallo = In corso, ⚪ Grigio = Da fare, 🔴 Rosso = Errore."
          },
          {
            title: "Test Consigliati",
            content: "Prima di usare la piattaforma con clienti reali: 1) Invia un'email di test 2) Crea un lead con il tuo numero e testa l'agente WhatsApp 3) Crea una consulenza di prova."
          },
          {
            title: "Supporto",
            content: "Se hai problemi durante la configurazione, usa l'Assistente AI in qualsiasi pagina per ricevere aiuto contestuale.",
            actionText: "Apri Assistente AI",
            actionHref: "/consultant/ai-assistant"
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 2: CORE - Pagine Principali
  // ═══════════════════════════════════════════════════════════════════

  dashboard: {
    emoji: "🏠",
    title: "Dashboard Principale",
    path: "/consultant",
    description: "La home del consulente con panoramica completa: KPI, attività in sospeso, navigazione rapida verso tutte le sezioni.",
    category: "core",
    sections: [
      {
        title: "PANORAMICA KPI",
        icon: "📊",
        description: "I 4 indicatori chiave mostrati in cima alla dashboard.",
        steps: [
          {
            title: "Clienti Attivi",
            content: "Numero totale di clienti attualmente attivi nel tuo portafoglio. Clicca per vedere la lista completa.",
            actionText: "Vai ai Clienti",
            actionHref: "/consultant/clients"
          },
          {
            title: "Esercizi da Revisionare",
            content: "Esercizi consegnati dai clienti che attendono la tua revisione. Priorità: revisionali entro 24-48h.",
            actionText: "Revisiona Esercizi",
            actionHref: "/consultant/exercises"
          },
          {
            title: "Consulenze Settimana",
            content: "Numero di consulenze programmate per questa settimana. Include scheduled e completed.",
            actionText: "Vai al Calendario",
            actionHref: "/consultant/appointments"
          },
          {
            title: "Lead Prioritari",
            content: "Lead con alta probabilità di conversione che richiedono attenzione. Basato su engagement e lead scoring.",
            actionText: "Gestisci Lead",
            actionHref: "/consultant/lead-hub"
          }
        ]
      },
      {
        title: "NAVIGAZIONE RAPIDA",
        icon: "🧭",
        description: "Accesso veloce a tutte le sezioni della piattaforma.",
        steps: [
          {
            title: "AI Assistant",
            content: "Chat con l'intelligenza artificiale per domande, analisi clienti, generazione contenuti.",
            actionText: "Apri Chat AI",
            actionHref: "/consultant/ai-assistant"
          },
          {
            title: "Clienti",
            content: "Gestione completa dei clienti: profili, percorsi, documenti, storico consulenze.",
            actionText: "Gestisci Clienti",
            actionHref: "/consultant/clients"
          },
          {
            title: "Calendario",
            content: "Visualizza e gestisci tutte le consulenze. Vista mensile con dettagli appuntamenti.",
            actionText: "Apri Calendario",
            actionHref: "/consultant/appointments"
          },
          {
            title: "Email Journey",
            content: "Gestione del percorso email automatico per i clienti. Monitora invii e engagement.",
            actionText: "Gestisci Email",
            actionHref: "/consultant/ai-config"
          },
          {
            title: "Lead Hub",
            content: "Centro di controllo per lead e campagne. Visualizza pipeline e conversioni.",
            actionText: "Apri Lead Hub",
            actionHref: "/consultant/lead-hub"
          },
          {
            title: "Agent Setup",
            content: "Configurazione e gestione degli agenti AI per WhatsApp.",
            actionText: "Configura Agenti",
            actionHref: "/consultant/whatsapp"
          },
          {
            title: "Formazione",
            content: "Corsi e contenuti formativi per i tuoi clienti.",
            actionText: "Gestisci Corsi",
            actionHref: "/consultant/university"
          },
          {
            title: "Knowledge Base",
            content: "Documenti e conoscenze che alimentano l'AI.",
            actionText: "Gestisci Documenti",
            actionHref: "/consultant/knowledge-documents"
          },
          {
            title: "File Search Analytics",
            content: "Analisi delle ricerche effettuate sui documenti.",
            actionText: "Vedi Analytics",
            actionHref: "/consultant/file-search-analytics"
          }
        ]
      },
      {
        title: "ITEMS IN ATTESA",
        icon: "⏳",
        description: "Elementi che richiedono la tua attenzione immediata.",
        steps: [
          {
            title: "Consulenze da Completare",
            content: "Consulenze passate non ancora marcate come completate. Importante: completa per generare email di riepilogo."
          },
          {
            title: "Bozze Email",
            content: "Email generate dall'AI in attesa di approvazione prima dell'invio."
          },
          {
            title: "Task Scaduti",
            content: "Task con scadenza passata che richiedono attenzione."
          },
          {
            title: "Lead Non Contattati",
            content: "Lead importati di recente che non hanno ancora ricevuto un primo contatto."
          }
        ]
      }
    ]
  },

  aiAssistant: {
    emoji: "🤖",
    title: "Assistente AI",
    path: "/consultant/ai-assistant",
    description: "Il tuo assistente personale basato su AI. Chat per domande, analisi, generazione contenuti e supporto operativo.",
    category: "core",
    sections: [
      {
        title: "COME USARE LA CHAT",
        icon: "💬",
        description: "Interagisci con l'AI per ricevere supporto su qualsiasi attività.",
        steps: [
          {
            title: "Avviare una Conversazione",
            content: "Scrivi la tua domanda o richiesta nel campo in basso e premi Invio. L'AI risponde in tempo reale con streaming."
          },
          {
            title: "Conversazioni Multiple",
            content: "Puoi avere più conversazioni salvate. Usa il pannello laterale per passare da una all'altra o crearne di nuove.",
            tips: ["Ogni conversazione mantiene il contesto", "Rinomina le conversazioni per organizzarle meglio"]
          },
          {
            title: "Quick Actions",
            content: "Usa le azioni rapide per operazioni comuni: analizza cliente, genera email, suggerisci esercizi.",
            tips: ["Le quick actions pre-compilano il prompt", "Puoi modificarle prima di inviare"]
          }
        ]
      },
      {
        title: "COSA PUÒ FARE L'AI",
        icon: "✨",
        description: "Esempi di richieste e funzionalità supportate.",
        steps: [
          {
            title: "Analisi Cliente",
            content: "Chiedi 'Analizza il cliente [nome]' per ricevere insights su progressi, aree di miglioramento, suggerimenti per la prossima sessione."
          },
          {
            title: "Generazione Email",
            content: "Chiedi 'Genera email per [cliente]' specificando il tipo (follow-up, motivazionale, riepilogo) per creare bozze personalizzate."
          },
          {
            title: "Suggerimenti Esercizi",
            content: "Chiedi 'Suggerisci esercizi per [obiettivo]' per ricevere idee di esercizi pratici basati sugli obiettivi del cliente."
          },
          {
            title: "Domande sulla Piattaforma",
            content: "Chiedi 'Come faccio a [azione]' per ricevere istruzioni su qualsiasi funzionalità della piattaforma."
          },
          {
            title: "Preparazione Consulenze",
            content: "Chiedi 'Prepara la consulenza con [cliente]' per ricevere un riepilogo della situazione e suggerimenti per la sessione."
          }
        ]
      },
      {
        title: "CONTESTO AUTOMATICO",
        icon: "🧠",
        description: "L'AI ha accesso automatico a informazioni utili.",
        steps: [
          {
            title: "Dati Clienti",
            content: "L'AI conosce i tuoi clienti: nomi, obiettivi, progressi, esercizi completati, storico consulenze."
          },
          {
            title: "Knowledge Base",
            content: "L'AI usa i documenti caricati nella Knowledge Base per dare risposte accurate e specifiche."
          },
          {
            title: "Guida Piattaforma",
            content: "L'AI conosce ogni funzionalità della piattaforma e può guidarti passo passo."
          }
        ]
      }
    ]
  },

  clients: {
    emoji: "👥",
    title: "Gestione Clienti",
    path: "/consultant/clients",
    description: "Lista completa dei tuoi clienti con profili dettagliati, filtri avanzati e azioni rapide.",
    category: "clients",
    sections: [
      {
        title: "LISTA CLIENTI",
        icon: "📋",
        description: "Visualizza e filtra tutti i tuoi clienti.",
        steps: [
          {
            title: "Vista Lista",
            content: "Ogni cliente mostra: nome, email, stato (attivo/inattivo), data ultimo contatto, prossima consulenza."
          },
          {
            title: "Filtri Disponibili",
            content: "Filtra per: stato (attivo/inattivo), ultima attività, con consulenze programmate, con esercizi in sospeso.",
            tips: ["I filtri si combinano", "Usa la ricerca per nome o email"]
          },
          {
            title: "Ordinamento",
            content: "Ordina per: nome, data creazione, ultima attività, prossima consulenza."
          }
        ]
      },
      {
        title: "CREARE NUOVO CLIENTE",
        icon: "➕",
        description: "Come aggiungere un nuovo cliente alla piattaforma.",
        steps: [
          {
            title: "Pulsante Nuovo Cliente",
            content: "Clicca 'Nuovo Cliente' in alto a destra per aprire il form di creazione.",
            actionText: "Crea Cliente",
            actionHref: "/consultant/clients"
          },
          {
            title: "Informazioni Base",
            content: "Compila: nome, cognome, email (obbligatori). Telefono, note, obiettivi (opzionali)."
          },
          {
            title: "Password Automatica",
            content: "Il sistema genera una password temporanea. Il cliente la cambierà al primo accesso."
          },
          {
            title: "Email di Benvenuto",
            content: "Opzione per inviare automaticamente un'email con credenziali e istruzioni per accedere."
          }
        ]
      },
      {
        title: "PROFILO CLIENTE",
        icon: "👤",
        description: "Dettagli e azioni disponibili nel profilo di ogni cliente.",
        steps: [
          {
            title: "Informazioni Generali",
            content: "Nome, contatti, data registrazione, stato account, livello percorso."
          },
          {
            title: "Obiettivi e Roadmap",
            content: "Definisci e monitora gli obiettivi del cliente. La roadmap mostra il percorso pianificato.",
            actionText: "Gestisci Roadmap",
            actionHref: "/consultant/client-roadmap"
          },
          {
            title: "Storico Consulenze",
            content: "Lista di tutte le consulenze passate con note, trascrizioni e email inviate."
          },
          {
            title: "Esercizi Assegnati",
            content: "Esercizi assegnati al cliente con stato: assegnato, in corso, completato, revisionato."
          },
          {
            title: "Documenti",
            content: "File e documenti condivisi con il cliente."
          },
          {
            title: "Azioni Rapide",
            content: "Prenota consulenza, assegna esercizio, invia email, genera analisi AI.",
            tips: ["Le azioni rapide sono nel menu '...' a destra"]
          }
        ]
      },
      {
        title: "STATISTICHE CLIENTI",
        icon: "📊",
        description: "Metriche e analytics sui tuoi clienti.",
        steps: [
          {
            title: "Engagement Score",
            content: "Punteggio basato su: frequenza accessi, esercizi completati, partecipazione consulenze."
          },
          {
            title: "Streak",
            content: "Giorni consecutivi di attività del cliente. Importante per la motivazione."
          },
          {
            title: "Progressi Obiettivi",
            content: "Percentuale di completamento degli obiettivi definiti."
          }
        ]
      }
    ]
  },

  appointments: {
    emoji: "📅",
    title: "Gestione Consulenze",
    path: "/consultant/appointments",
    description: "Calendario professionale per gestire tutte le tue consulenze. Vista mensile, gestione email post-consulenza, integrazione video.",
    category: "clients",
    sections: [
      {
        title: "VISTA CALENDARIO",
        icon: "🗓️",
        description: "Calendario mensile con tutte le consulenze.",
        steps: [
          {
            title: "Navigazione",
            content: "Usa le frecce per spostarti tra i mesi. Il giorno corrente è evidenziato in arancione."
          },
          {
            title: "Visualizzazione Appuntamenti",
            content: "Ogni giorno mostra il numero di consulenze. Clicca su un giorno per vedere i dettagli."
          },
          {
            title: "Indicatori Email",
            content: "I punti colorati indicano lo stato email: 🟢 Inviata, 🟡 Bozza, 🔴 Mancante."
          },
          {
            title: "Statistiche Mese",
            content: "In alto vedi: totale consulenze, completate, email inviate, bozze pronte."
          }
        ]
      },
      {
        title: "CREARE CONSULENZA",
        icon: "➕",
        description: "Come programmare una nuova consulenza.",
        steps: [
          {
            title: "Nuovo Appuntamento",
            content: "Clicca su un giorno nel calendario o usa il pulsante 'Nuova Consulenza'.",
            actionText: "Crea Consulenza",
            actionHref: "/consultant/appointments"
          },
          {
            title: "Seleziona Cliente",
            content: "Scegli il cliente dalla lista. Se non esiste, crealo prima dalla sezione Clienti."
          },
          {
            title: "Data e Ora",
            content: "Imposta data, ora di inizio e durata (default 60 minuti)."
          },
          {
            title: "Link Video (Opzionale)",
            content: "Aggiungi link Google Meet o altra piattaforma. Può essere generato automaticamente se hai configurato Calendar."
          },
          {
            title: "Note Preparazione",
            content: "Aggiungi note per prepararti alla consulenza. L'AI le userà per suggerimenti."
          }
        ]
      },
      {
        title: "GESTIRE CONSULENZA",
        icon: "📝",
        description: "Azioni durante e dopo la consulenza.",
        steps: [
          {
            title: "Visualizza Dettagli",
            content: "Clicca su una consulenza per vedere tutti i dettagli: cliente, orario, note, link video."
          },
          {
            title: "Avvia Video",
            content: "Se configurato, clicca 'Avvia Video' per aprire la videocall.",
            tips: ["Integrazione con Fathom per trascrizione automatica"]
          },
          {
            title: "Completare Consulenza",
            content: "Dopo la sessione, clicca 'Completa' per: aggiungere note, link Fathom, generare email di riepilogo.",
            tips: ["Puoi segnalare se servono ricerche o esercizi", "Opzione per creare task di follow-up"]
          },
          {
            title: "Generare Email Riepilogo",
            content: "L'AI genera automaticamente un'email con i punti chiave. Revisiona e invia o salva come bozza."
          }
        ]
      },
      {
        title: "STATI CONSULENZA",
        icon: "📊",
        description: "I diversi stati di una consulenza.",
        steps: [
          {
            title: "Scheduled (Programmata)",
            content: "Consulenza futura confermata. Il cliente riceve reminder automatici."
          },
          {
            title: "Completed (Completata)",
            content: "Consulenza svolta. Può avere note, trascrizione e email di follow-up."
          },
          {
            title: "Cancelled (Annullata)",
            content: "Consulenza annullata. Motivo salvato per analytics."
          }
        ]
      },
      {
        title: "TASK COLLEGATI",
        icon: "✅",
        description: "Gestione dei task legati alle consulenze.",
        steps: [
          {
            title: "Task Manager",
            content: "Nella pagina Appointments trovi anche il Task Manager espandibile per vedere tutti i task."
          },
          {
            title: "Creazione Task",
            content: "Al completamento di una consulenza, puoi creare task di follow-up automatici."
          },
          {
            title: "Categorie Task",
            content: "Preparation (preparazione), Follow-up, Exercise (esercizio), Goal (obiettivo), Reminder (promemoria)."
          },
          {
            title: "Priorità",
            content: "Urgent (urgente), High (alta), Medium (media), Low (bassa)."
          }
        ]
      }
    ]
  },

  tasks: {
    emoji: "✅",
    title: "Gestione Task",
    path: "/consultant/tasks",
    description: "Vista centralizzata di tutti i task del consulente. Filtra per stato, priorità, categoria. Raggruppa per consulenza.",
    category: "clients",
    sections: [
      {
        title: "PANORAMICA TASK",
        icon: "📋",
        description: "Vista generale di tutti i tuoi task.",
        steps: [
          {
            title: "Statistiche in Alto",
            content: "Vedi: totale task, completati, in sospeso, urgenti. Indicatori per priorità."
          },
          {
            title: "Raggruppa per Consulenza",
            content: "I task sono organizzati per consulenza di origine. Espandi per vedere i dettagli."
          },
          {
            title: "Task Estratti da Echo",
            content: "Sezione separata per i task estratti automaticamente dalle trascrizioni Fathom/Echo.",
            tips: ["Questi task sono in 'bozza' finché non li confermi", "Puoi scartarli o attivarli"]
          }
        ]
      },
      {
        title: "FILTRI",
        icon: "🔍",
        description: "Come filtrare i task.",
        steps: [
          {
            title: "Filtro Stato",
            content: "Tutti, Completati, In Sospeso."
          },
          {
            title: "Filtro Priorità",
            content: "Tutte, Urgente, Alta, Media, Bassa."
          },
          {
            title: "Filtro Categoria",
            content: "Tutte, Preparazione, Follow-up, Esercizio, Obiettivo, Promemoria."
          },
          {
            title: "Ricerca",
            content: "Cerca per titolo, descrizione o nome cliente."
          }
        ]
      },
      {
        title: "GESTIRE UN TASK",
        icon: "✏️",
        description: "Azioni disponibili su ogni task.",
        steps: [
          {
            title: "Completare Task",
            content: "Clicca il checkbox per segnare come completato. Viene registrata la data."
          },
          {
            title: "Modificare",
            content: "Clicca sul task per aprire il pannello di modifica con tutti i campi."
          },
          {
            title: "Cambiare Priorità",
            content: "Nel pannello modifica puoi cambiare la priorità."
          },
          {
            title: "Vai al Cliente",
            content: "Link diretto al profilo del cliente associato."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 3: COMMUNICATION - Email e Comunicazioni
  // ═══════════════════════════════════════════════════════════════════

  aiConfig: {
    emoji: "⚙️",
    title: "Configurazione AI & Email",
    path: "/consultant/ai-config",
    description: "Centro di controllo per email automatiche, journey email, scheduler, template e configurazioni SMTP.",
    category: "communication",
    sections: [
      {
        title: "TAB: EMAIL JOURNEY",
        icon: "📧",
        description: "Sistema di email automatiche per il percorso clienti (31 giorni).",
        steps: [
          {
            title: "Come Funziona",
            content: "Ogni cliente riceve email automatiche basate sui template del giorno del mese. Es: Giorno 1 = Benvenuto, Giorno 15 = Check-in, ecc.",
            tips: ["28 template standard + 3 extra per mesi lunghi", "L'AI personalizza ogni email per il cliente"]
          },
          {
            title: "Vista Clienti Journey",
            content: "Tabella che mostra tutti i clienti nel journey con: giorno corrente, ultima email, azioni completate, fase (early/mid/late)."
          },
          {
            title: "Filtri Journey",
            content: "Filtra per: stato azioni (completate, pending, non avviate), fase del mese (primi 10 giorni, 10-20, ultimi giorni)."
          },
          {
            title: "Tipi Email",
            content: "Motivazionale (ispirazione), Riflessione (recap progressi), Azione (task specifici). Badge colorato per tipo."
          },
          {
            title: "Azioni Email",
            content: "Ogni email può contenere azioni suggerite. Traccia quante sono state completate dal cliente."
          }
        ]
      },
      {
        title: "TAB: TEMPLATE EMAIL",
        icon: "📝",
        description: "Gestione dei 31 template per l'email journey.",
        steps: [
          {
            title: "Lista Template",
            content: "I 31 template organizzati per giorno del mese. Ogni template ha: titolo, tipo, prompt, priorità."
          },
          {
            title: "Modificare Template",
            content: "Clicca su un template per modificare il prompt. L'AI userà questo prompt per generare l'email personalizzata."
          },
          {
            title: "Variabili Disponibili",
            content: "{{nome_cliente}}, {{obiettivi}}, {{ultimo_progresso}}, {{esercizi_completati}}, {{prossima_consulenza}}."
          },
          {
            title: "Attivare/Disattivare",
            content: "Puoi disattivare singoli template. L'email di quel giorno non verrà inviata."
          }
        ]
      },
      {
        title: "TAB: BOZZE EMAIL",
        icon: "📨",
        description: "Gestione delle email generate in attesa di approvazione.",
        steps: [
          {
            title: "Lista Bozze",
            content: "Tutte le email generate dall'AI in attesa della tua approvazione prima dell'invio."
          },
          {
            title: "Anteprima",
            content: "Clicca su una bozza per vedere: destinatario, oggetto, corpo email, metadata."
          },
          {
            title: "Modificare",
            content: "Puoi modificare oggetto e corpo prima di approvare."
          },
          {
            title: "Approvare e Inviare",
            content: "Clicca 'Approva e Invia' per inviare immediatamente."
          },
          {
            title: "Scartare",
            content: "Clicca 'Scarta' per eliminare la bozza senza inviare."
          }
        ]
      },
      {
        title: "TAB: IMPOSTAZIONI SMTP",
        icon: "📤",
        description: "Configurazione del server email per l'invio.",
        steps: [
          {
            title: "Dati Server",
            content: "Host (es: smtp.gmail.com), Porta (es: 587), Sicurezza (TLS/SSL)."
          },
          {
            title: "Credenziali",
            content: "Username (solitamente email), Password (o App Password per Gmail).",
            warnings: ["Per Gmail: crea una 'App Password' nelle impostazioni sicurezza Google"]
          },
          {
            title: "Mittente",
            content: "Email e nome che appariranno come mittente."
          },
          {
            title: "Test Invio",
            content: "Pulsante per inviare email di test e verificare la configurazione."
          }
        ]
      },
      {
        title: "TAB: SCHEDULER",
        icon: "⏰",
        description: "Configurazione dell'invio automatico email.",
        steps: [
          {
            title: "Attivare Scheduler",
            content: "Switch per abilitare/disabilitare l'invio automatico email."
          },
          {
            title: "Frequenza",
            content: "Ogni quanti giorni inviare email ai clienti (default: 1 giorno)."
          },
          {
            title: "Orario Invio",
            content: "A che ora inviare le email (raccomandato: mattina presto)."
          },
          {
            title: "Log Esecuzione",
            content: "Storico delle esecuzioni dello scheduler con: clienti processati, email inviate, bozze create, errori."
          },
          {
            title: "Pausa Scheduler",
            content: "Puoi mettere in pausa lo scheduler senza disabilitarlo. Utile per vacanze."
          }
        ]
      },
      {
        title: "TAB: AUTOMAZIONE CLIENTI",
        icon: "🔄",
        description: "Gestione automazione per singolo cliente.",
        steps: [
          {
            title: "Lista Clienti",
            content: "Ogni cliente ha un toggle per abilitare/disabilitare l'automazione email."
          },
          {
            title: "Stato Automazione",
            content: "Vedi per ogni cliente: ultima email inviata, prossima email, giorni mancanti, totale email inviate."
          },
          {
            title: "Disattivare per Cliente",
            content: "Disattiva l'automazione per clienti che preferiscono comunicazioni manuali."
          }
        ]
      }
    ]
  },

  emailJourney: {
    emoji: "📬",
    title: "Email Journey",
    path: "/consultant/email-journey",
    description: "Vista dedicata al percorso email dei clienti. Monitora progressi, azioni completate e engagement.",
    category: "communication",
    sections: [
      {
        title: "DASHBOARD JOURNEY",
        icon: "📊",
        description: "Panoramica del sistema email journey.",
        steps: [
          {
            title: "Statistiche Generali",
            content: "Totale clienti nel journey, clienti attivi, azioni completate, azioni in sospeso."
          },
          {
            title: "Fasi del Journey",
            content: "Early (1-10), Mid (11-20), Late (21-31). Vedi quanti clienti in ogni fase."
          },
          {
            title: "Progresso Clienti",
            content: "Lista clienti con giorno corrente, email ricevute, azioni suggerite vs completate."
          }
        ]
      },
      {
        title: "GESTIONE CLIENTI",
        icon: "👥",
        description: "Azioni sui singoli clienti nel journey.",
        steps: [
          {
            title: "Dettaglio Cliente",
            content: "Clicca per vedere: storico email ricevute, azioni suggerite per ogni email, stato completamento."
          },
          {
            title: "Reinviare Email",
            content: "Opzione per reinviare un'email specifica se non ricevuta."
          },
          {
            title: "Reset Journey",
            content: "Riavvia il journey dal giorno 1 per un cliente.",
            warnings: ["Questa azione non è reversibile"]
          }
        ]
      }
    ]
  },

  emailLogs: {
    emoji: "📋",
    title: "Log Email",
    path: "/consultant/email-logs",
    description: "Storico completo di tutte le email inviate. Utile per debugging e analytics.",
    category: "communication",
    sections: [
      {
        title: "STORICO EMAIL",
        icon: "📜",
        description: "Lista di tutte le email inviate.",
        steps: [
          {
            title: "Informazioni",
            content: "Ogni entry mostra: destinatario, oggetto, data/ora invio, stato (inviata/fallita)."
          },
          {
            title: "Filtri",
            content: "Filtra per: destinatario, tipo email, range date, stato."
          },
          {
            title: "Dettaglio Email",
            content: "Clicca per vedere il corpo completo dell'email inviata."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 4: LEAD & AUTOMATION - Acquisizione Clienti
  // ═══════════════════════════════════════════════════════════════════

  leadHub: {
    emoji: "🎯",
    title: "Lead Hub - Centro Controllo",
    path: "/consultant/lead-hub",
    description: "Centro di controllo per l'acquisizione clienti. Visualizza il flusso completo: Lead → Campagne → Template → Automazioni.",
    category: "automation",
    sections: [
      {
        title: "FLUSSO VISUALE",
        icon: "🔄",
        description: "Il percorso di acquisizione visualizzato come flusso di 5 step.",
        steps: [
          {
            title: "Step 1: Lead Proattivi",
            content: "Carica e gestisci i tuoi contatti da Excel/CSV o manualmente. Ogni lead è un potenziale cliente.",
            actionText: "Gestisci Lead",
            actionHref: "/consultant/proactive-leads"
          },
          {
            title: "Step 2: Campagne",
            content: "Organizza i lead in campagne con obiettivi specifici. Ogni campagna ha un 'uncino' - frase di apertura.",
            actionText: "Crea Campagna",
            actionHref: "/consultant/campaigns"
          },
          {
            title: "Step 3: Template WhatsApp",
            content: "Scegli i template approvati da Meta per i messaggi. Usa variabili per personalizzare.",
            actionText: "Gestisci Template",
            actionHref: "/consultant/whatsapp-templates"
          },
          {
            title: "Step 4: Template Personalizzati",
            content: "Crea template su misura con pulsanti e media. Sottomettili a Meta per approvazione.",
            actionText: "Crea Template Custom",
            actionHref: "/consultant/whatsapp/custom-templates/list"
          },
          {
            title: "Step 5: Automazioni",
            content: "Configura follow-up automatici, risposte AI e gestione pipeline 24/7.",
            actionText: "Configura Automazioni",
            actionHref: "/consultant/automations"
          }
        ]
      },
      {
        title: "TIPS PER STEP",
        icon: "💡",
        description: "Suggerimenti contestuali per ogni fase.",
        steps: [
          {
            title: "Tips Lead",
            content: "Importa da Excel/CSV, segmenta con tag, usa lead scoring, contatta entro 24-48h."
          },
          {
            title: "Tips Campagne",
            content: "Obiettivi chiari, pianifica gli invii, monitora metriche, segmenta il pubblico."
          },
          {
            title: "Tips Template",
            content: "Approvazione Meta 24-48h, usa variabili, messaggi brevi con CTA chiara."
          },
          {
            title: "Tips Automazioni",
            content: "Follow-up automatici, AI Responder per FAQ, pipeline automatica, notifiche smart."
          }
        ]
      },
      {
        title: "ASSISTENTE INTEGRATO",
        icon: "🤖",
        description: "L'AI Assistant nel Lead Hub.",
        steps: [
          {
            title: "Pannello Destro",
            content: "Sul lato destro trovi l'assistente AI pronto a rispondere su lead e campagne."
          },
          {
            title: "Domande Suggerite",
            content: "L'AI può aiutarti con: 'Come importo i lead?', 'Come creo una campagna efficace?', 'Quali template funzionano meglio?'"
          }
        ]
      }
    ]
  },

  proactiveLeads: {
    emoji: "👥",
    title: "Lead Proattivi",
    path: "/consultant/proactive-leads",
    description: "Gestione completa dei lead: importazione, creazione manuale, tagging, scoring, assegnazione a campagne.",
    category: "automation",
    sections: [
      {
        title: "LISTA LEAD",
        icon: "📋",
        description: "Visualizza e gestisci tutti i tuoi lead.",
        steps: [
          {
            title: "Informazioni Lead",
            content: "Ogni lead mostra: nome, telefono, email, fonte, data creazione, stato, score."
          },
          {
            title: "Stati Lead",
            content: "Pending (nuovo), Contacted (contattato), Responded (ha risposto), Converted (convertito), Lost (perso)."
          },
          {
            title: "Filtri",
            content: "Filtra per: stato, fonte, tag, campagna, range date."
          }
        ]
      },
      {
        title: "IMPORTARE LEAD",
        icon: "📥",
        description: "Come importare lead da file.",
        steps: [
          {
            title: "Formati Supportati",
            content: "Excel (.xlsx) e CSV (.csv)."
          },
          {
            title: "Colonne Richieste",
            content: "Nome (o nome + cognome), Telefono (formato internazionale preferito).",
            tips: ["Colonne opzionali: email, azienda, note, tag"]
          },
          {
            title: "Mappatura Colonne",
            content: "Se i nomi colonne sono diversi, usa la mappatura automatica o manuale."
          },
          {
            title: "Duplicati",
            content: "Il sistema rileva duplicati per numero di telefono. Scegli se saltare o aggiornare."
          }
        ]
      },
      {
        title: "CREARE LEAD MANUALMENTE",
        icon: "➕",
        description: "Aggiungere un lead singolo.",
        steps: [
          {
            title: "Pulsante Nuovo Lead",
            content: "Clicca 'Nuovo Lead' in alto a destra.",
            actionText: "Crea Lead",
            actionHref: "/consultant/proactive-leads"
          },
          {
            title: "Dati Obbligatori",
            content: "Nome e Telefono (formato: +39xxxxxxxxxx)."
          },
          {
            title: "Dati Opzionali",
            content: "Email, azienda, note, tag personalizzati."
          }
        ]
      },
      {
        title: "LEAD SCORING",
        icon: "⭐",
        description: "Sistema di punteggio per prioritizzare i lead.",
        steps: [
          {
            title: "Come Funziona",
            content: "Ogni lead riceve un punteggio basato su: interazioni, risposte, engagement, profilo."
          },
          {
            title: "Punteggi Automatici",
            content: "+10 risposta, +5 clic link, +20 prenotazione appuntamento, -10 per ogni giorno di silenzio."
          },
          {
            title: "Lead Prioritari",
            content: "I lead con score alto appaiono in cima e sono evidenziati in dashboard."
          }
        ]
      }
    ]
  },

  campaigns: {
    emoji: "📢",
    title: "Campagne Marketing",
    path: "/consultant/campaigns",
    description: "Crea e gestisci campagne WhatsApp per raggiungere gruppi di lead. Traccia conversioni e performance.",
    category: "automation",
    sections: [
      {
        title: "LISTA CAMPAGNE",
        icon: "📋",
        description: "Panoramica delle tue campagne.",
        steps: [
          {
            title: "Informazioni Campagna",
            content: "Nome, uncino, lead totali, messaggi inviati, tassi risposta/conversione, stato."
          },
          {
            title: "Stati Campagna",
            content: "Draft (bozza), Active (attiva), Paused (in pausa), Completed (completata)."
          },
          {
            title: "Metriche Chiave",
            content: "Delivery rate (consegnati), Response rate (risposte), Conversion rate (convertiti)."
          }
        ]
      },
      {
        title: "CREARE CAMPAGNA",
        icon: "➕",
        description: "Come creare una nuova campagna.",
        steps: [
          {
            title: "Nome e Descrizione",
            content: "Dai un nome chiaro e descrivi l'obiettivo della campagna."
          },
          {
            title: "Uncino (IMPORTANTE)",
            content: "La frase di apertura che cattura l'attenzione. Es: 'Automatizza le tue prenotazioni con un QR code'.",
            tips: ["L'uncino viene usato in tutti i messaggi della campagna", "Deve essere rilevante per il target"]
          },
          {
            title: "Seleziona Lead",
            content: "Scegli quali lead includere nella campagna. Puoi filtrare per tag, fonte, stato."
          },
          {
            title: "Scegli Template",
            content: "Seleziona il template WhatsApp da usare per il primo messaggio."
          },
          {
            title: "Collega Agente (Opzionale)",
            content: "Assegna un agente AI per gestire le risposte automaticamente."
          }
        ]
      },
      {
        title: "GESTIRE CAMPAGNA",
        icon: "⚙️",
        description: "Azioni disponibili su una campagna attiva.",
        steps: [
          {
            title: "Avviare Campagna",
            content: "Clicca 'Avvia' per iniziare l'invio messaggi. Partono in sequenza secondo la configurazione."
          },
          {
            title: "Mettere in Pausa",
            content: "Puoi mettere in pausa per fermare gli invii mantenendo i progressi."
          },
          {
            title: "Monitorare Risultati",
            content: "Vedi in tempo reale: messaggi inviati, consegnati, risposte ricevute."
          },
          {
            title: "Vedere Conversazioni",
            content: "Link per vedere tutte le conversazioni generate dalla campagna."
          }
        ]
      },
      {
        title: "DRY RUN (TEST)",
        icon: "🧪",
        description: "Testare prima di inviare realmente.",
        steps: [
          {
            title: "Modalità Test",
            content: "Attiva 'Dry Run' per simulare l'invio senza mandare messaggi reali.",
            tips: ["Utile per verificare template e configurazione", "I messaggi vengono loggati ma non inviati"]
          },
          {
            title: "Test con Proprio Numero",
            content: "Aggiungi te stesso come lead di test per ricevere i messaggi e verificare."
          }
        ]
      }
    ]
  },

  automations: {
    emoji: "⚡",
    title: "Automazioni",
    path: "/consultant/automations",
    description: "Configura regole automatiche per follow-up, reminder, gestione pipeline. L'AI lavora per te 24/7.",
    category: "automation",
    sections: [
      {
        title: "LISTA AUTOMAZIONI",
        icon: "📋",
        description: "Le tue regole di automazione.",
        steps: [
          {
            title: "Informazioni",
            content: "Nome regola, trigger, azione, volte eseguita, ultima esecuzione, stato (attiva/disattiva)."
          },
          {
            title: "Attivare/Disattivare",
            content: "Switch per abilitare o disabilitare ogni automazione."
          }
        ]
      },
      {
        title: "CREARE AUTOMAZIONE",
        icon: "➕",
        description: "Come creare una nuova regola.",
        steps: [
          {
            title: "Trigger (Quando)",
            content: "Evento che attiva l'automazione: lead non risponde dopo X giorni, nuovo lead importato, lead cambia stato."
          },
          {
            title: "Condizioni (Se)",
            content: "Filtri aggiuntivi: solo lead di campagna X, solo lead con tag Y, solo in orario lavorativo."
          },
          {
            title: "Azione (Allora)",
            content: "Cosa fare: invia messaggio WhatsApp, cambia stato lead, notifica consulente, assegna a campagna."
          },
          {
            title: "Limitazioni",
            content: "Max esecuzioni per lead, delay tra esecuzioni, esclusioni.",
            tips: ["Evita di bombardare i lead con troppi messaggi"]
          }
        ]
      },
      {
        title: "AUTOMAZIONI COMUNI",
        icon: "💡",
        description: "Esempi di automazioni utili.",
        steps: [
          {
            title: "Follow-up 3 Giorni",
            content: "Se lead non risponde dopo 3 giorni, invia messaggio di follow-up."
          },
          {
            title: "Benvenuto Nuovo Lead",
            content: "Quando un lead viene importato, invia messaggio di benvenuto entro 1 ora."
          },
          {
            title: "Notifica Lead Caldo",
            content: "Quando lead risponde positivamente, notifica immediatamente il consulente."
          },
          {
            title: "Re-engagement",
            content: "Se lead fermo da 7 giorni, invia messaggio con offerta speciale."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 5: WHATSAPP - Agenti e Messaggistica
  // ═══════════════════════════════════════════════════════════════════

  whatsapp: {
    emoji: "💚",
    title: "WhatsApp Dashboard",
    path: "/consultant/whatsapp",
    description: "Centro di controllo WhatsApp: statistiche, agenti attivi, conversazioni recenti, pipeline lead.",
    category: "automation",
    sections: [
      {
        title: "STATISTICHE",
        icon: "📊",
        description: "Panoramica delle attività WhatsApp.",
        steps: [
          {
            title: "Messaggi Oggi",
            content: "Totale messaggi inviati e ricevuti oggi."
          },
          {
            title: "Conversazioni Attive",
            content: "Numero di conversazioni con attività nelle ultime 24h."
          },
          {
            title: "Tasso Risposta",
            content: "Percentuale di lead che hanno risposto ai tuoi messaggi."
          },
          {
            title: "Lead Convertiti",
            content: "Lead passati a stato 'Converted' questo mese."
          }
        ]
      },
      {
        title: "AGENTI ATTIVI",
        icon: "🤖",
        description: "I tuoi agenti AI WhatsApp.",
        steps: [
          {
            title: "Lista Agenti",
            content: "Tutti i tuoi agenti con: nome, tipo (inbound/outbound/consultative), stato (attivo/pausa), conversazioni gestite."
          },
          {
            title: "Creare Nuovo Agente",
            content: "Clicca 'Nuovo Agente' per avviare la procedura guidata di creazione.",
            actionText: "Crea Agente",
            actionHref: "/consultant/whatsapp/agent/new"
          },
          {
            title: "Configurare Agente",
            content: "Clicca su un agente per vedere/modificare: personalità, script, knowledge base, risposte."
          }
        ]
      },
      {
        title: "PIPELINE",
        icon: "📈",
        description: "Visualizza lo stato dei lead nella pipeline.",
        steps: [
          {
            title: "Colonne Pipeline",
            content: "Nuovo → Contattato → Risposto → Qualificato → Appuntamento → Convertito"
          },
          {
            title: "Drag & Drop",
            content: "Trascina i lead tra le colonne per cambiare stato manualmente."
          },
          {
            title: "Filtri Pipeline",
            content: "Filtra per: agente, campagna, periodo."
          }
        ]
      }
    ]
  },

  whatsappAgentConfig: {
    emoji: "🤖",
    title: "Configurazione Agente WhatsApp",
    path: "/consultant/whatsapp/agent/new",
    description: "Wizard di creazione agente AI: personalità, script, knowledge base, configurazioni avanzate.",
    category: "automation",
    sections: [
      {
        title: "TAB: INFORMAZIONI BASE",
        icon: "📝",
        description: "Dati fondamentali dell'agente.",
        steps: [
          {
            title: "Nome Agente",
            content: "Es: 'Marco - Setter', 'Assistente Principale'. Il nome appare nelle conversazioni."
          },
          {
            title: "Tipo Agente",
            content: "Inbound (riceve), Outbound (invia), Consultative (supporto)."
          },
          {
            title: "Descrizione",
            content: "Cosa fa l'agente, per quali campagne è usato."
          }
        ]
      },
      {
        title: "TAB: PERSONALITÀ",
        icon: "🎭",
        description: "Definisci il carattere e lo stile dell'agente.",
        steps: [
          {
            title: "Tono",
            content: "Formale, Amichevole, Professionale, Entusiasta."
          },
          {
            title: "Personalità Base",
            content: "Prompt che definisce chi è l'agente: background, expertise, modo di comunicare.",
            tips: ["Più dettagli = risposte più coerenti", "Includi esempi di frasi tipiche"]
          },
          {
            title: "Linee Guida",
            content: "Cosa deve e non deve fare: argomenti da evitare, limiti, escalation a umano."
          }
        ]
      },
      {
        title: "TAB: SCRIPT",
        icon: "📋",
        description: "Flusso di conversazione strutturato.",
        steps: [
          {
            title: "Step Conversazione",
            content: "Definisci gli step: Saluto → Qualifica → Proposta → Chiusura."
          },
          {
            title: "Messaggi Template",
            content: "Per ogni step, scrivi il messaggio base che l'AI adatterà al contesto."
          },
          {
            title: "Obiettivi Step",
            content: "Cosa deve ottenere ogni step: nome lead, interesse, disponibilità appuntamento."
          },
          {
            title: "Gestione Obiezioni",
            content: "Come rispondere a: 'Non ho tempo', 'Costa troppo', 'Ci devo pensare'."
          }
        ]
      },
      {
        title: "TAB: KNOWLEDGE BASE",
        icon: "📚",
        description: "Connetti documenti per risposte accurate.",
        steps: [
          {
            title: "Seleziona Documenti",
            content: "Scegli quali documenti della Knowledge Base l'agente può consultare."
          },
          {
            title: "FAQ Dedicate",
            content: "Aggiungi FAQ specifiche per questo agente."
          },
          {
            title: "Link Utili",
            content: "URL che l'agente può condividere: pricing, calendly, portfolio."
          }
        ]
      },
      {
        title: "TAB: CONFIGURAZIONI",
        icon: "⚙️",
        description: "Impostazioni avanzate.",
        steps: [
          {
            title: "Orari Attività",
            content: "Quando l'agente può rispondere. Fuori orario: messaggio automatico o silenzio."
          },
          {
            title: "Delay Risposta",
            content: "Secondi di attesa prima di rispondere (più naturale)."
          },
          {
            title: "Escalation",
            content: "Quando passare a un umano: dopo X messaggi, parole chiave, richiesta esplicita."
          },
          {
            title: "Link Pubblico",
            content: "Genera URL condivisibile per permettere a chiunque di contattare questo agente.",
            actionText: "Gestisci Link",
            actionHref: "/consultant/whatsapp-agents-chat"
          }
        ]
      }
    ]
  },

  whatsappTemplates: {
    emoji: "📝",
    title: "Template WhatsApp",
    path: "/consultant/whatsapp-templates",
    description: "Gestione template approvati da Meta per messaggi WhatsApp Business.",
    category: "automation",
    sections: [
      {
        title: "LISTA TEMPLATE",
        icon: "📋",
        description: "I tuoi template WhatsApp.",
        steps: [
          {
            title: "Informazioni",
            content: "Nome, categoria (utility/marketing), stato approvazione, ultima modifica."
          },
          {
            title: "Stati Template",
            content: "Approved (approvato), Pending (in attesa), Rejected (rifiutato)."
          },
          {
            title: "Preview",
            content: "Clicca per vedere l'anteprima del messaggio con variabili."
          }
        ]
      },
      {
        title: "TIPI TEMPLATE",
        icon: "📂",
        description: "Categorie di template WhatsApp.",
        steps: [
          {
            title: "Utility",
            content: "Per conferme, notifiche, aggiornamenti. Meno restrizioni, approvazione veloce."
          },
          {
            title: "Marketing",
            content: "Per promozioni e acquisizione. Più restrizioni, serve consenso esplicito.",
            warnings: ["Meta può rifiutare template troppo aggressivi"]
          },
          {
            title: "Authentication",
            content: "Per codici OTP e verifiche. Formato molto specifico."
          }
        ]
      },
      {
        title: "VARIABILI",
        icon: "🔤",
        description: "Personalizzazione dinamica.",
        steps: [
          {
            title: "Variabili Disponibili",
            content: "{nome_lead}, {uncino}, {obiettivi}, {desideri}, {azienda}."
          },
          {
            title: "Sintassi",
            content: "Usa {{1}}, {{2}}, ecc. nel template. Mappa i valori al momento dell'invio."
          },
          {
            title: "Esempi",
            content: "'Ciao {{1}}, ho visto che sei interessato a {{2}}' → 'Ciao Mario, ho visto che sei interessato all'automazione'"
          }
        ]
      }
    ]
  },

  whatsappCustomTemplates: {
    emoji: "✏️",
    title: "Template Personalizzati",
    path: "/consultant/whatsapp/custom-templates/list",
    description: "Crea template WhatsApp personalizzati con header, footer e pulsanti. Sottometti a Meta per approvazione.",
    category: "automation",
    sections: [
      {
        title: "CREARE TEMPLATE",
        icon: "➕",
        description: "Processo di creazione template personalizzato.",
        steps: [
          {
            title: "Nome e Categoria",
            content: "Nome univoco (lettere minuscole e underscore). Categoria: marketing o utility."
          },
          {
            title: "Header (Opzionale)",
            content: "Testo, immagine, video o documento in cima al messaggio."
          },
          {
            title: "Body (Obbligatorio)",
            content: "Il testo principale del messaggio. Max 1024 caratteri.",
            tips: ["Usa {{1}}, {{2}} per variabili", "Formattazione: *grassetto*, _italico_"]
          },
          {
            title: "Footer (Opzionale)",
            content: "Testo piccolo in fondo, es: 'Rispondi STOP per disiscriverti'."
          },
          {
            title: "Pulsanti (Opzionale)",
            content: "Quick reply (risposte rapide) o Call to action (URL, telefono).",
            tips: ["Max 3 pulsanti", "I pulsanti aumentano l'engagement"]
          }
        ]
      },
      {
        title: "APPROVAZIONE META",
        icon: "✅",
        description: "Processo di approvazione.",
        steps: [
          {
            title: "Sottomissione",
            content: "Dopo la creazione, clicca 'Sottometti per Approvazione'."
          },
          {
            title: "Tempi",
            content: "L'approvazione richiede 24-48 ore. A volte di più.",
            warnings: ["Non puoi usare il template finché non è approvato"]
          },
          {
            title: "Rifiuto",
            content: "Se rifiutato, vedi il motivo e modifica di conseguenza. Poi risottometti."
          }
        ]
      }
    ]
  },

  whatsappConversations: {
    emoji: "💬",
    title: "Conversazioni WhatsApp",
    path: "/consultant/whatsapp-conversations",
    description: "Tutte le conversazioni WhatsApp con lead e clienti. Storico messaggi, stato, note.",
    category: "automation",
    sections: [
      {
        title: "LISTA CONVERSAZIONI",
        icon: "📋",
        description: "Visualizza le conversazioni.",
        steps: [
          {
            title: "Informazioni",
            content: "Contatto, ultimo messaggio, data, stato (attiva/chiusa), agente assegnato."
          },
          {
            title: "Filtri",
            content: "Per stato, agente, campagna, periodo."
          },
          {
            title: "Ricerca",
            content: "Cerca per nome, telefono o contenuto messaggio."
          }
        ]
      },
      {
        title: "DETTAGLIO CONVERSAZIONE",
        icon: "💬",
        description: "Visualizza e gestisci una conversazione.",
        steps: [
          {
            title: "Storico Messaggi",
            content: "Tutti i messaggi in ordine cronologico. Messaggi in/out con timestamp."
          },
          {
            title: "Intervento Manuale",
            content: "Puoi scrivere un messaggio manualmente nella conversazione.",
            tips: ["Se intervieni, l'agente si mette in pausa per quella conversazione"]
          },
          {
            title: "Cambio Stato Lead",
            content: "Modifica lo stato del lead direttamente dalla conversazione."
          },
          {
            title: "Note",
            content: "Aggiungi note interne visibili solo a te."
          }
        ]
      }
    ]
  },

  whatsappAgentsChat: {
    emoji: "🔗",
    title: "Link Pubblici Agenti",
    path: "/consultant/whatsapp-agents-chat",
    description: "Gestisci i link pubblici per i tuoi agenti WhatsApp. I lead possono iniziare conversazioni direttamente.",
    category: "automation",
    sections: [
      {
        title: "LINK PUBBLICI",
        icon: "🔗",
        description: "URL condivisibili per ogni agente.",
        steps: [
          {
            title: "Generare Link",
            content: "Per ogni agente puoi generare un link pubblico unico."
          },
          {
            title: "Come Funziona",
            content: "Chi visita il link può inserire nome e telefono per iniziare una chat con l'agente."
          },
          {
            title: "Dove Condividere",
            content: "Social media, sito web, biglietti da visita, email signature, QR code.",
            tips: ["Crea QR code per materiale cartaceo"]
          }
        ]
      },
      {
        title: "GESTIONE LINK",
        icon: "⚙️",
        description: "Configurazioni avanzate.",
        steps: [
          {
            title: "Personalizzazione",
            content: "Modifica messaggio di benvenuto e campi richiesti."
          },
          {
            title: "Statistiche",
            content: "Vedi quanti lead arrivano da ogni link."
          },
          {
            title: "Disattivare Link",
            content: "Puoi disattivare un link senza eliminare l'agente."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 6: CONTENT - Formazione e Contenuti
  // ═══════════════════════════════════════════════════════════════════

  university: {
    emoji: "🎓",
    title: "University - Formazione",
    path: "/consultant/university",
    description: "Crea e gestisci corsi formativi per i tuoi clienti. Moduli, lezioni, quiz, certificati.",
    category: "content",
    sections: [
      {
        title: "LISTA CORSI",
        icon: "📚",
        description: "I tuoi corsi formativi.",
        steps: [
          {
            title: "Informazioni Corso",
            content: "Nome, descrizione, numero moduli, studenti iscritti, tasso completamento."
          },
          {
            title: "Stati Corso",
            content: "Draft (bozza), Published (pubblicato), Archived (archiviato)."
          }
        ]
      },
      {
        title: "CREARE CORSO",
        icon: "➕",
        description: "Come creare un nuovo corso.",
        steps: [
          {
            title: "Informazioni Base",
            content: "Nome, descrizione, obiettivi, prerequisiti, durata stimata."
          },
          {
            title: "Moduli",
            content: "Dividi il corso in moduli tematici. Ogni modulo contiene lezioni."
          },
          {
            title: "Lezioni",
            content: "Ogni lezione può avere: video, testo, slide, link esterni."
          },
          {
            title: "Quiz",
            content: "Aggiungi quiz alla fine di moduli per verificare l'apprendimento."
          },
          {
            title: "Certificato",
            content: "Abilita certificato di completamento automatico."
          }
        ]
      },
      {
        title: "GENERATORE AI",
        icon: "✨",
        description: "L'AI ti aiuta a creare contenuti.",
        steps: [
          {
            title: "Genera Idee",
            content: "Descrivi il tuo target e l'AI suggerisce argomenti e struttura corso."
          },
          {
            title: "Genera Contenuti",
            content: "L'AI può scrivere bozze di lezioni basandosi su outline."
          },
          {
            title: "Genera Quiz",
            content: "L'AI crea domande basate sul contenuto delle lezioni."
          }
        ]
      },
      {
        title: "ASSEGNARE CORSI",
        icon: "👥",
        description: "Come assegnare corsi ai clienti.",
        steps: [
          {
            title: "Assegnazione Singola",
            content: "Dal profilo cliente, clicca 'Assegna Corso'."
          },
          {
            title: "Assegnazione Multipla",
            content: "Dalla lista corsi, seleziona e assegna a più clienti."
          },
          {
            title: "Scadenza",
            content: "Opzionale: imposta una data limite per completare il corso."
          }
        ]
      }
    ]
  },

  exerciseTemplates: {
    emoji: "📝",
    title: "Template Esercizi",
    path: "/consultant/exercise-templates",
    description: "Crea template riutilizzabili per esercizi da assegnare ai clienti.",
    category: "content",
    sections: [
      {
        title: "LISTA TEMPLATE",
        icon: "📋",
        description: "I tuoi template esercizi.",
        steps: [
          {
            title: "Informazioni",
            content: "Nome, descrizione, categoria, difficoltà, tempo stimato."
          },
          {
            title: "Categorie",
            content: "Riflessione, Azione, Scrittura, Analisi, Pratica."
          }
        ]
      },
      {
        title: "CREARE TEMPLATE",
        icon: "➕",
        description: "Come creare un template esercizio.",
        steps: [
          {
            title: "Informazioni Base",
            content: "Nome, descrizione dettagliata, categoria, tempo stimato."
          },
          {
            title: "Istruzioni",
            content: "Cosa deve fare il cliente, passo per passo."
          },
          {
            title: "Domande Guida",
            content: "Domande che aiutano il cliente a riflettere."
          },
          {
            title: "Criteri Valutazione",
            content: "Come valuti l'esercizio completato."
          }
        ]
      }
    ]
  },

  exercises: {
    emoji: "✍️",
    title: "Esercizi Assegnati",
    path: "/consultant/exercises",
    description: "Tutti gli esercizi assegnati ai clienti. Revisiona, dai feedback, traccia completamenti.",
    category: "content",
    sections: [
      {
        title: "LISTA ESERCIZI",
        icon: "📋",
        description: "Esercizi da revisionare.",
        steps: [
          {
            title: "Filtri",
            content: "Da revisionare, In corso, Completati, Tutti."
          },
          {
            title: "Informazioni",
            content: "Cliente, esercizio, data assegnazione, scadenza, stato."
          },
          {
            title: "Priorità",
            content: "Gli esercizi scaduti o vicini a scadenza sono evidenziati."
          }
        ]
      },
      {
        title: "REVISIONARE ESERCIZIO",
        icon: "✅",
        description: "Come revisionare un esercizio completato.",
        steps: [
          {
            title: "Leggi Risposta",
            content: "Visualizza cosa ha scritto/fatto il cliente."
          },
          {
            title: "Dai Feedback",
            content: "Scrivi commenti costruttivi. L'AI può suggerire feedback."
          },
          {
            title: "Valutazione",
            content: "Opzionale: assegna un punteggio o badge."
          },
          {
            title: "Completa Revisione",
            content: "Marca come revisionato. Il cliente riceve notifica."
          }
        ]
      }
    ]
  },

  library: {
    emoji: "📖",
    title: "Libreria Documenti",
    path: "/consultant/library",
    description: "Documenti condivisi con i clienti: PDF, guide, risorse. Organizza per categoria.",
    category: "content",
    sections: [
      {
        title: "GESTIONE DOCUMENTI",
        icon: "📁",
        description: "Organizza la tua libreria.",
        steps: [
          {
            title: "Upload Documento",
            content: "Carica PDF, Word, PowerPoint, immagini."
          },
          {
            title: "Categorie",
            content: "Organizza in cartelle/categorie per argomento."
          },
          {
            title: "Visibilità",
            content: "Pubblico (tutti i clienti) o Privato (singoli clienti)."
          }
        ]
      },
      {
        title: "CONDIVIDERE",
        icon: "🔗",
        description: "Come condividere con i clienti.",
        steps: [
          {
            title: "Link Diretto",
            content: "Ogni documento ha un link univoco condivisibile."
          },
          {
            title: "Assegnazione",
            content: "Assegna documenti specifici a clienti specifici."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 7: KNOWLEDGE - Documenti e Conoscenza AI
  // ═══════════════════════════════════════════════════════════════════

  knowledgeDocuments: {
    emoji: "🧠",
    title: "Knowledge Base - Documenti",
    path: "/consultant/knowledge-documents",
    description: "Documenti che alimentano l'AI. Carica PDF, testi, FAQ per risposte più accurate.",
    category: "analytics",
    sections: [
      {
        title: "GESTIONE DOCUMENTI",
        icon: "📁",
        description: "I documenti della Knowledge Base.",
        steps: [
          {
            title: "Upload",
            content: "Carica PDF, Word, TXT. L'AI indicizza automaticamente i contenuti."
          },
          {
            title: "Formati Supportati",
            content: "PDF, DOCX, TXT. Max 10MB per file."
          },
          {
            title: "Stato Indicizzazione",
            content: "Pending (in coda), Processing (elaborazione), Indexed (pronto), Error (errore)."
          }
        ]
      },
      {
        title: "COME USA L'AI",
        icon: "🤖",
        description: "Come i documenti vengono usati.",
        steps: [
          {
            title: "Ricerca Semantica",
            content: "L'AI cerca nei documenti per trovare informazioni rilevanti."
          },
          {
            title: "Risposte Accurate",
            content: "Le risposte dell'assistente citano i documenti come fonte."
          },
          {
            title: "Agenti WhatsApp",
            content: "Gli agenti usano la Knowledge Base per rispondere ai lead."
          }
        ]
      }
    ]
  },

  knowledgeApis: {
    emoji: "🔌",
    title: "Knowledge Base - API",
    path: "/consultant/knowledge-apis",
    description: "Connetti API esterne per arricchire la Knowledge Base con dati in tempo reale.",
    category: "analytics",
    sections: [
      {
        title: "API DISPONIBILI",
        icon: "🔗",
        description: "Integrazioni API supportate.",
        steps: [
          {
            title: "API Custom",
            content: "Connetti qualsiasi API REST che restituisce JSON."
          },
          {
            title: "Configurazione",
            content: "URL endpoint, metodo (GET/POST), headers, autenticazione."
          },
          {
            title: "Mappatura Dati",
            content: "Definisci quali campi JSON usare come conoscenza."
          }
        ]
      }
    ]
  },

  fileSearchAnalytics: {
    emoji: "🔍",
    title: "File Search Analytics",
    path: "/consultant/file-search-analytics",
    description: "Analytics sulle ricerche effettuate nella Knowledge Base. Vedi cosa cercano clienti e AI.",
    category: "analytics",
    sections: [
      {
        title: "STATISTICHE RICERCHE",
        icon: "📊",
        description: "Metriche sulle ricerche.",
        steps: [
          {
            title: "Ricerche Totali",
            content: "Numero totale di ricerche effettuate."
          },
          {
            title: "Query Frequenti",
            content: "Le ricerche più comuni. Utile per capire cosa cercano."
          },
          {
            title: "Hit Rate",
            content: "Percentuale di ricerche che trovano risultati."
          },
          {
            title: "Gap Analysis",
            content: "Ricerche senza risultati: indica contenuti mancanti da aggiungere.",
            tips: ["Aggiungi documenti per colmare i gap"]
          }
        ]
      },
      {
        title: "DOCUMENTI SINCRONIZZATI",
        icon: "📄",
        description: "Documenti disponibili per la ricerca.",
        steps: [
          {
            title: "Lista Documenti",
            content: "Tutti i documenti indicizzati con stato e data ultimo sync."
          },
          {
            title: "Sync Automatico",
            content: "La guida del software viene sincronizzata automaticamente per tutti i consulenti.",
            tips: ["La guida si aggiorna quando viene modificata"]
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 8: SETTINGS - Impostazioni e API
  // ═══════════════════════════════════════════════════════════════════

  apiKeysUnified: {
    emoji: "🔑",
    title: "API Keys Unificate",
    path: "/consultant/api-keys-unified",
    description: "Centro unico per tutte le integrazioni API: Vertex AI, Twilio, Google, SMTP.",
    category: "settings",
    sections: [
      {
        title: "GOOGLE VERTEX AI",
        icon: "🧠",
        description: "Configurazione AI.",
        steps: [
          {
            title: "Project ID",
            content: "L'ID del tuo progetto Google Cloud."
          },
          {
            title: "Location",
            content: "Regione (es: us-central1, europe-west1)."
          },
          {
            title: "Credenziali",
            content: "Carica il file JSON delle credenziali Service Account."
          },
          {
            title: "Test",
            content: "Pulsante per verificare che la connessione funzioni."
          }
        ]
      },
      {
        title: "TWILIO WHATSAPP",
        icon: "💚",
        description: "Configurazione WhatsApp.",
        steps: [
          {
            title: "Account SID",
            content: "Trovalo nella dashboard Twilio."
          },
          {
            title: "Auth Token",
            content: "Token di autenticazione (tieni segreto)."
          },
          {
            title: "Numero WhatsApp",
            content: "Il numero WhatsApp Business collegato a Twilio."
          },
          {
            title: "Webhook URL",
            content: "URL da configurare in Twilio per ricevere messaggi."
          }
        ]
      },
      {
        title: "GOOGLE CALENDAR",
        icon: "📅",
        description: "Sincronizzazione calendario.",
        steps: [
          {
            title: "Autorizzazione",
            content: "Clicca 'Collega Google Account' per autorizzare."
          },
          {
            title: "Calendario Principale",
            content: "Seleziona quale calendario usare per le consulenze."
          }
        ]
      }
    ]
  },

  profileSettings: {
    emoji: "👤",
    title: "Impostazioni Profilo",
    path: "/consultant/profile-settings",
    description: "Gestisci il tuo profilo consulente: foto, bio, contatti, preferenze.",
    category: "settings",
    sections: [
      {
        title: "INFORMAZIONI PERSONALI",
        icon: "📝",
        description: "I tuoi dati.",
        steps: [
          {
            title: "Nome e Cognome",
            content: "Come appari ai clienti."
          },
          {
            title: "Email",
            content: "Email per comunicazioni e notifiche."
          },
          {
            title: "Foto Profilo",
            content: "Carica una foto professionale."
          },
          {
            title: "Bio",
            content: "Breve descrizione delle tue competenze."
          }
        ]
      },
      {
        title: "PREFERENZE",
        icon: "⚙️",
        description: "Personalizza l'esperienza.",
        steps: [
          {
            title: "Notifiche",
            content: "Quali notifiche ricevere via email."
          },
          {
            title: "Lingua",
            content: "Lingua dell'interfaccia."
          },
          {
            title: "Fuso Orario",
            content: "Per la corretta visualizzazione degli appuntamenti."
          }
        ]
      }
    ]
  },

  calendarSettings: {
    emoji: "📅",
    title: "Impostazioni Calendario",
    path: "/consultant/calendar-settings",
    description: "Configura integrazione Google Calendar per gli agenti, disponibilità, durata slot.",
    category: "settings",
    sections: [
      {
        title: "GOOGLE CALENDAR AGENTI",
        icon: "🔗",
        description: "Collegamento Google Calendar a livello di agente WhatsApp.",
        steps: [
          {
            title: "Collega Calendar all'Agente",
            content: "Vai nella sezione Dipendenti/Agenti, seleziona un agente e clicca 'Collega Google Calendar' nel pannello laterale."
          },
          {
            title: "Sincronizzazione",
            content: "Gli appuntamenti prenotati tramite l'agente WhatsApp appaiono automaticamente sul Google Calendar collegato."
          },
          {
            title: "Calendario per Agente",
            content: "Ogni agente può avere il proprio Google Calendar, permettendo di gestire calendari separati per diversi servizi o team."
          }
        ]
      },
      {
        title: "DISPONIBILITÀ",
        icon: "⏰",
        description: "Quando sei disponibile per consulenze.",
        steps: [
          {
            title: "Giorni Lavorativi",
            content: "Seleziona i giorni in cui accetti appuntamenti."
          },
          {
            title: "Orari",
            content: "Imposta orario di inizio e fine giornata lavorativa."
          },
          {
            title: "Buffer",
            content: "Tempo di pausa tra un appuntamento e l'altro."
          }
        ]
      }
    ]
  },

  smtpSettings: {
    emoji: "📧",
    title: "Impostazioni SMTP",
    path: "/consultant/smtp-settings",
    description: "Configurazione server email per invio automatico.",
    category: "settings",
    sections: [
      {
        title: "CONFIGURAZIONE SERVER",
        icon: "⚙️",
        description: "Dati del server SMTP.",
        steps: [
          {
            title: "Host",
            content: "Indirizzo del server (es: smtp.gmail.com)."
          },
          {
            title: "Porta",
            content: "Porta del server (587 per TLS, 465 per SSL)."
          },
          {
            title: "Sicurezza",
            content: "TLS (raccomandato) o SSL."
          },
          {
            title: "Username",
            content: "Solitamente il tuo indirizzo email."
          },
          {
            title: "Password",
            content: "Password email o App Password.",
            warnings: ["Per Gmail: genera una 'App Password' nelle impostazioni sicurezza"]
          }
        ]
      },
      {
        title: "MITTENTE",
        icon: "✉️",
        description: "Come appari quando invii email.",
        steps: [
          {
            title: "Email Mittente",
            content: "L'indirizzo che appare come mittente."
          },
          {
            title: "Nome Mittente",
            content: "Il nome che appare (es: 'Mario Rossi - Coach')."
          },
          {
            title: "Test Invio",
            content: "Invia email di prova per verificare la configurazione."
          }
        ]
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 9: ANALYTICS E ALTRO
  // ═══════════════════════════════════════════════════════════════════

  aiConsultations: {
    emoji: "🎙️",
    title: "Consulenze AI",
    path: "/consultant/ai-consultations",
    description: "Storico delle consulenze con trascrizioni AI, analisi e insights generati automaticamente.",
    category: "analytics",
    sections: [
      {
        title: "LISTA CONSULENZE",
        icon: "📋",
        description: "Tutte le consulenze con dati AI.",
        steps: [
          {
            title: "Informazioni",
            content: "Cliente, data, durata, stato trascrizione, insights disponibili."
          },
          {
            title: "Filtri",
            content: "Per cliente, periodo, con/senza trascrizione."
          }
        ]
      },
      {
        title: "DETTAGLIO CONSULENZA",
        icon: "📝",
        description: "Analisi completa di una consulenza.",
        steps: [
          {
            title: "Trascrizione",
            content: "Testo completo della conversazione (se integrato Fathom)."
          },
          {
            title: "Insights AI",
            content: "Punti chiave estratti automaticamente dall'AI."
          },
          {
            title: "Task Suggeriti",
            content: "Task estratti dalla conversazione da confermare."
          },
          {
            title: "Email Generate",
            content: "Bozze email basate sulla consulenza."
          }
        ]
      }
    ]
  },

  echoDashboard: {
    emoji: "🔊",
    title: "Echo Dashboard",
    path: "/consultant/echo-dashboard",
    description: "Dashboard per l'integrazione Echo/Fathom: trascrizioni video, estrazione task, analisi conversazioni.",
    category: "analytics",
    sections: [
      {
        title: "PANORAMICA",
        icon: "📊",
        description: "Statistiche Echo.",
        steps: [
          {
            title: "Consulenze Trascritte",
            content: "Numero totale di consulenze con trascrizione."
          },
          {
            title: "Task Estratti",
            content: "Totale task identificati automaticamente."
          },
          {
            title: "Tempo Risparmiato",
            content: "Stima del tempo risparmiato grazie all'automazione."
          }
        ]
      },
      {
        title: "FATHOM INTEGRATION",
        icon: "🔗",
        description: "Come funziona l'integrazione.",
        steps: [
          {
            title: "Link Fathom",
            content: "Dopo una consulenza video, incolla il link Fathom per importare la trascrizione."
          },
          {
            title: "Estrazione Automatica",
            content: "L'AI estrae: punti chiave, task, action items dalla trascrizione."
          },
          {
            title: "Revisione",
            content: "Controlla e conferma i task estratti prima di attivarli."
          }
        ]
      }
    ]
  },

  roadmap: {
    emoji: "🗺️",
    title: "Roadmap Clienti",
    path: "/consultant/roadmap",
    description: "Visualizza e gestisci i percorsi dei tuoi clienti. Timeline obiettivi, milestone, progressi.",
    category: "clients",
    sections: [
      {
        title: "VISTA ROADMAP",
        icon: "📍",
        description: "Panoramica percorsi.",
        steps: [
          {
            title: "Timeline",
            content: "Visualizzazione temporale degli obiettivi e milestone."
          },
          {
            title: "Milestone",
            content: "Traguardi principali del percorso con stato (raggiunto/in corso/futuro)."
          },
          {
            title: "Progressi",
            content: "Percentuale completamento per ogni obiettivo."
          }
        ]
      }
    ]
  },

  guides: {
    emoji: "📚",
    title: "Centro Guide",
    path: "/consultant/guides",
    description: "Hub con tutte le guide disponibili per navigare la piattaforma.",
    category: "core",
    sections: [
      {
        title: "GUIDE DISPONIBILI",
        icon: "📖",
        description: "Lista guide organizzate per argomento.",
        steps: [
          {
            title: "Guide Navigazione",
            content: "Come navigare ogni sezione della piattaforma."
          },
          {
            title: "Guide Setup",
            content: "Come configurare le integrazioni."
          },
          {
            title: "Best Practices",
            content: "Consigli per ottenere il massimo dalla piattaforma."
          }
        ]
      }
    ]
  }
};

/**
 * Helper function to format guides for AI prompt
 * Genera il testo formattato da includere nel prompt dell'AI
 */
export function formatGuidesForPrompt(guides: ConsultantGuides): string {
  let formattedText = `📚 GUIDA COMPLETA PIATTAFORMA CONSULENTE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Questa guida documenta OGNI pagina e funzionalità della piattaforma.
Usa queste informazioni per aiutare i consulenti a navigare e usare il software.

`;

  // Group guides by category
  const categories: Record<string, Guide[]> = {};
  Object.values(guides).forEach((guide) => {
    if (!categories[guide.category]) {
      categories[guide.category] = [];
    }
    categories[guide.category].push(guide);
  });

  const categoryNames: Record<string, string> = {
    onboarding: "🚀 ONBOARDING",
    core: "🏠 CORE",
    clients: "👥 CLIENTI",
    communication: "📧 COMUNICAZIONE",
    automation: "⚡ AUTOMAZIONE",
    content: "📚 CONTENUTI",
    analytics: "📊 ANALYTICS",
    settings: "⚙️ IMPOSTAZIONI"
  };

  Object.entries(categories).forEach(([category, categoryGuides]) => {
    formattedText += `\n═══════════════════════════════════════════════════════════════════
${categoryNames[category] || category.toUpperCase()}
═══════════════════════════════════════════════════════════════════\n\n`;

    categoryGuides.forEach((guide) => {
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
          if (step.tips && step.tips.length > 0) {
            step.tips.forEach(tip => {
              formattedText += `   💡 ${tip}\n`;
            });
          }
          if (step.warnings && step.warnings.length > 0) {
            step.warnings.forEach(warning => {
              formattedText += `   ⚠️ ${warning}\n`;
            });
          }
          formattedText += `\n`;
        });

        formattedText += `\n`;
      });

      formattedText += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });
  });

  return formattedText;
}

/**
 * Helper per esportare la guida come documento per File Search
 */
export function getGuideAsDocument(): { title: string; content: string } {
  return {
    title: "Guida Completa Piattaforma Consulente",
    content: formatGuidesForPrompt(consultantGuides)
  };
}

/**
 * Helper per ottenere le guide per categoria
 */
export function getGuidesByCategory(category: Guide['category']): Guide[] {
  return Object.values(consultantGuides).filter(guide => guide.category === category);
}

/**
 * Helper per cercare nelle guide
 */
export function searchGuides(query: string): Guide[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(consultantGuides).filter(guide => 
    guide.title.toLowerCase().includes(lowerQuery) ||
    guide.description.toLowerCase().includes(lowerQuery) ||
    guide.path.toLowerCase().includes(lowerQuery) ||
    guide.sections.some(section => 
      section.title.toLowerCase().includes(lowerQuery) ||
      section.description.toLowerCase().includes(lowerQuery) ||
      section.steps.some(step => 
        step.title.toLowerCase().includes(lowerQuery) ||
        step.content.toLowerCase().includes(lowerQuery)
      )
    )
  );
}
