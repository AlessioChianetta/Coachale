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
 * ULTIMO AGGIORNAMENTO: 27 Dicembre 2025 - AI Assistant Agent Integration v2
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
  navigation: string;
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
    navigation: "Sidebar → PRINCIPALE → Setup Iniziale",
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
            actionText: "Vai a Setup Iniziale",
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
            actionText: "Vai a I tuoi dipendenti",
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
            actionText: "Vai a I tuoi dipendenti",
            actionHref: "/consultant/whatsapp-agents-chat",
            tips: ["Il link può essere condiviso su social, sito web, biglietti da visita", "Il lead viene automaticamente aggiunto alla pipeline"]
          },
          {
            title: "2.5 Idee AI Generate",
            content: "L'AI può generare idee creative per i tuoi agenti basandosi sul tuo settore e target.",
            actionText: "Vai a I tuoi dipendenti",
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
            actionText: "Vai a Università",
            actionHref: "/consultant/university",
            tips: ["I clienti possono seguire i corsi dalla loro area", "Traccia i progressi e il completamento"]
          },
          {
            title: "3.2 Primo Esercizio",
            content: "Crea esercizi pratici che i clienti devono completare. Ricevi notifiche quando vengono consegnati per la revisione.",
            actionText: "Vai a Template",
            actionHref: "/consultant/exercise-templates",
            tips: ["Gli esercizi aiutano i clienti ad applicare quanto appreso", "Puoi impostare scadenze e priorità"]
          },
          {
            title: "3.3 Base di Conoscenza",
            content: "Carica documenti, PDF, e contenuti che l'AI userà per rispondere alle domande. Più informazioni carichi, più accurate saranno le risposte.",
            actionText: "Vai a Documenti",
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
            actionText: "Vai a Calendario",
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
            actionText: "Vai a AI Assistant",
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
    navigation: "Sidebar → PRINCIPALE → Dashboard",
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
            actionText: "Vai a Clienti",
            actionHref: "/consultant/clients"
          },
          {
            title: "Esercizi da Revisionare",
            content: "Esercizi consegnati dai clienti che attendono la tua revisione. Priorità: revisionali entro 24-48h.",
            actionText: "Vai a Esercizi",
            actionHref: "/consultant/exercises"
          },
          {
            title: "Consulenze Settimana",
            content: "Numero di consulenze programmate per questa settimana. Include scheduled e completed.",
            actionText: "Vai a Calendario",
            actionHref: "/consultant/appointments"
          },
          {
            title: "Lead Prioritari",
            content: "Lead con alta probabilità di conversione che richiedono attenzione. Basato su engagement e lead scoring.",
            actionText: "Vai a HUB Lead",
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
            actionText: "Vai a AI Assistant",
            actionHref: "/consultant/ai-assistant"
          },
          {
            title: "Clienti",
            content: "Gestione completa dei clienti: profili, percorsi, documenti, storico consulenze.",
            actionText: "Vai a Clienti",
            actionHref: "/consultant/clients"
          },
          {
            title: "Calendario",
            content: "Visualizza e gestisci tutte le consulenze. Vista mensile con dettagli appuntamenti.",
            actionText: "Vai a Calendario",
            actionHref: "/consultant/appointments"
          },
          {
            title: "Email Journey",
            content: "Gestione del percorso email automatico per i clienti. Monitora invii e engagement.",
            actionText: "Vai a Email Journey",
            actionHref: "/consultant/ai-config"
          },
          {
            title: "Lead Hub",
            content: "Centro di controllo per lead e campagne. Visualizza pipeline e conversioni.",
            actionText: "Vai a HUB Lead",
            actionHref: "/consultant/lead-hub"
          },
          {
            title: "Agent Setup",
            content: "Configurazione e gestione degli agenti AI per WhatsApp.",
            actionText: "Vai a I tuoi dipendenti",
            actionHref: "/consultant/whatsapp"
          },
          {
            title: "Formazione",
            content: "Corsi e contenuti formativi per i tuoi clienti.",
            actionText: "Vai a Università",
            actionHref: "/consultant/university"
          },
          {
            title: "Knowledge Base",
            content: "Documenti e conoscenze che alimentano l'AI.",
            actionText: "Vai a Documenti",
            actionHref: "/consultant/knowledge-documents"
          },
          {
            title: "File Search Analytics",
            content: "Analisi delle ricerche effettuate sui documenti.",
            actionText: "Vai a File Search",
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
    navigation: "Sidebar → PRINCIPALE → AI Assistant",
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
      },
      {
        title: "PREFERENZE AI STILE CHATGPT (v2)",
        icon: "⚙️",
        description: "Personalizza come l'AI comunica con te. Clicca l'icona ingranaggio nella chat per aprire il pannello preferenze.",
        steps: [
          {
            title: "Stili di Scrittura Disponibili",
            content: "9 stili tra cui scegliere: Predefinito (naturale e bilanciato), Professionale (cortese e preciso), Amichevole (espansivo e caloroso), Schietto (diretto e incoraggiante), Eccentrico (vivace e fantasioso), Efficiente (essenziale e semplice), Nerd (curioso e approfondito), Cinico (critico e sarcastico), Personalizzato (istruzioni custom).",
            tips: ["Lo stile 'Predefinito' è il più versatile", "Usa 'Professionale' per comunicazioni formali", "Lo stile 'Personalizzato' permette istruzioni libere"]
          },
          {
            title: "Lunghezza Risposte",
            content: "3 opzioni: Breve (risposte concise e dirette), Bilanciata (equilibrio tra completezza e brevità), Completa (risposte dettagliate e approfondite).",
            tips: ["'Breve' ideale per domande semplici", "'Completa' per analisi approfondite"]
          },
          {
            title: "Istruzioni Personalizzate",
            content: "Se scegli lo stile 'Personalizzato', puoi scrivere istruzioni specifiche che l'AI seguirà in tutte le conversazioni.",
            tips: ["Es: 'Rispondi sempre in italiano formale, usa elenchi puntati'", "Le istruzioni si applicano a TUTTE le tue conversazioni"]
          }
        ]
      },
      {
        title: "SELEZIONE AGENTE (v2)",
        icon: "🤖",
        description: "Puoi usare i tuoi agenti WhatsApp anche nell'AI Assistant.",
        steps: [
          {
            title: "Dropdown Agente",
            content: "In alto nella chat trovi un dropdown per selezionare un agente. Gli agenti con 'Abilita in AI Assistant' attivo appaiono qui.",
            tips: ["Ogni agente ha personalità e istruzioni diverse", "L'agente selezionato influenza il tono e le risposte"]
          },
          {
            title: "Cronologia Per-Agente",
            content: "Le conversazioni sono separate per ogni agente. Cambiando agente vedrai solo le conversazioni fatte con quell'agente specifico.",
            tips: ["Utile per mantenere contesti separati", "Le nuove conversazioni vengono associate all'agente selezionato"]
          },
          {
            title: "Condividere Agenti con Clienti",
            content: "Puoi condividere agenti specifici con i tuoi clienti usando 'Condividi con Clienti' nelle impostazioni agente. I clienti vedranno solo gli agenti condivisi con loro."
          }
        ]
      }
    ]
  },

  clients: {
    emoji: "👥",
    title: "Gestione Clienti",
    path: "/consultant/clients",
    navigation: "Sidebar → LAVORO QUOTIDIANO → Clienti",
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
    navigation: "Sidebar → LAVORO QUOTIDIANO → Calendario",
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
            actionText: "Vai a Calendario",
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
    navigation: "Sidebar → LAVORO QUOTIDIANO → Task",
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
    navigation: "Sidebar → LAVORO QUOTIDIANO → Email Journey",
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
    path: "/consultant/ai-config",
    navigation: "Sidebar → LAVORO QUOTIDIANO → Email Journey",
    description: "Vista dedicata al percorso email dei clienti. Monitora progressi, azioni completate e engagement. Questa è la pagina principale dell'Email Journey accessibile dalla sidebar.",
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
    navigation: "Sidebar → LAVORO QUOTIDIANO → Email Journey → Tab Log",
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
    navigation: "Sidebar → COMUNICAZIONE → HUB Lead",
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
            actionText: "Vai a HUB Lead",
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
    navigation: "Sidebar → COMUNICAZIONE → HUB Lead → Tab Lead",
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
    navigation: "Sidebar → COMUNICAZIONE → HUB Lead → Tab Campagne",
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
    navigation: "Sidebar → COMUNICAZIONE → HUB Lead → Tab Automazioni",
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
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti",
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
            actionText: "Vai a I tuoi dipendenti",
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
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti → Nuovo Agente",
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
        title: "TAB: PERSONALITÀ E BRAND VOICE",
        icon: "🎭",
        description: "Definisci il carattere, lo stile dell'agente e le categorie di contenuti che può usare.",
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
          },
          {
            title: "Categorie File Search (v2)",
            content: "Seleziona quali tipi di contenuti l'agente può cercare e utilizzare nelle risposte. 6 categorie disponibili: Corsi, Lezioni, Esercizi, Knowledge Base, Libreria, University.",
            tips: ["Disabilita categorie non rilevanti per risposte più focalizzate", "Le categorie influenzano sia WhatsApp che link pubblici e AI Assistant"],
            warnings: ["Se disabiliti tutte le categorie, l'agente non potrà usare File Search"]
          },
          {
            title: "Abilita in AI Assistant (v2)",
            content: "Attiva questa opzione per rendere l'agente disponibile anche nell'AI Assistant del consulente e dei clienti condivisi.",
            tips: ["Utile per testare l'agente senza usare WhatsApp", "I clienti vedranno solo agenti condivisi esplicitamente con loro"]
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
            actionText: "Vai a I tuoi dipendenti",
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
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti → Tab Template",
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
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti → Tab Template Custom",
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
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti → Tab Conversazioni",
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
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti → Tab Link Pubblici",
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

  instagramDM: {
    emoji: "📸",
    title: "Instagram DM Integration",
    path: "/consultant/guide-instagram",
    navigation: "Sidebar → COMUNICAZIONE → Guide → Instagram DM",
    description: "Configura Instagram Business per ricevere e rispondere automaticamente ai DM con AI. Gestisci la finestra 24 ore, story replies e comment-to-DM.",
    category: "communication",
    sections: [
      {
        title: "PREREQUISITI E SETUP ACCOUNT",
        icon: "🔧",
        description: "Configurazione dell'account Instagram Business e delle credenziali Meta.",
        steps: [
          {
            title: "Requisiti Account",
            content: "Devi avere: 1) Account Instagram Business o Creator (non personale) 2) Pagina Facebook collegata all'account Instagram 3) App Meta for Developers creata con prodotto 'Instagram' aggiunto.",
            warnings: ["Account personali NON possono ricevere webhook DM", "La pagina Facebook DEVE essere collegata all'account Instagram"]
          },
          {
            title: "Trovare Page ID",
            content: "Vai su business.facebook.com → La tua Pagina → Impostazioni → Trasparenza della Pagina. Il Page ID è il numero identificativo della tua pagina Facebook collegata a Instagram.",
            tips: ["Il Page ID è un numero lungo (es: 123456789012345)", "Puoi anche trovarlo nell'URL della pagina Facebook"]
          },
          {
            title: "Generare Access Token",
            content: "Vai su developers.facebook.com → La tua App → Tools → Graph API Explorer. Seleziona la tua App e la Page, poi aggiungi i permessi: instagram_manage_messages, pages_messaging. Genera il token e copialo.",
            tips: ["Token temporanei scadono dopo 1 ora", "Per produzione usa Long-Lived Token (60 giorni) o System User Token (permanente)"],
            warnings: ["Senza permessi corretti, i webhook non funzioneranno"]
          },
          {
            title: "Trovare App Secret",
            content: "Vai su developers.facebook.com → La tua App → Settings → Basic. Clicca 'Show' accanto a 'App Secret' e copia la stringa alfanumerica. L'App Secret serve per verificare le richieste webhook (HMAC signature).",
            actionText: "Vai a API Keys",
            actionHref: "/consultant/api-keys-unified?tab=instagram"
          },
          {
            title: "Configurare in Coachale",
            content: "Vai su API Keys → Tab 'Instagram'. Inserisci: Page ID, Access Token, App Secret. Seleziona l'Agente WhatsApp da collegare (l'agente Instagram usa le stesse impostazioni AI dell'agente WhatsApp). Salva la configurazione.",
            actionText: "Configura Instagram",
            actionHref: "/consultant/api-keys-unified?tab=instagram"
          }
        ]
      },
      {
        title: "CONFIGURAZIONE WEBHOOK",
        icon: "🔗",
        description: "Setup del webhook per ricevere notifiche in tempo reale da Instagram.",
        steps: [
          {
            title: "Accedere a Meta for Developers",
            content: "Vai su developers.facebook.com → La tua App → Prodotti → Messenger (o Instagram) → Webhooks.",
            tips: ["Se non vedi Webhooks, aggiungi prima il prodotto 'Messenger' o 'Instagram' alla tua app"]
          },
          {
            title: "URL Callback Webhook",
            content: "Inserisci l'URL callback: https://TUO-DOMINIO/api/instagram/webhook. Sostituisci TUO-DOMINIO con il dominio del tuo deployment Coachale.",
            warnings: ["L'URL deve essere HTTPS", "L'URL deve essere accessibile pubblicamente"]
          },
          {
            title: "Token di Verifica",
            content: "Inserisci un token di verifica a tua scelta (es: 'coachale_instagram_verify_2024'). Questo token deve corrispondere a quello configurato nel server.",
            tips: ["Usa una stringa lunga e casuale per sicurezza"]
          },
          {
            title: "Sottoscrizioni Webhook",
            content: "Abilita le sottoscrizioni: 'messages' (per ricevere DM), 'messaging_postbacks' (per quick replies). Opzionali: 'story_mentions', 'comments' per funzionalità avanzate.",
            tips: ["Inizia solo con 'messages', poi aggiungi altre sottoscrizioni"]
          },
          {
            title: "Verifica Webhook",
            content: "Clicca 'Verify and Save'. Meta invierà una richiesta GET al tuo endpoint. Se la verifica fallisce, controlla: URL corretto, token corretto, server attivo."
          }
        ]
      },
      {
        title: "FUNZIONALITÀ E LIMITI",
        icon: "⚡",
        description: "Come funziona l'integrazione Instagram e le limitazioni da conoscere.",
        steps: [
          {
            title: "Finestra 24 Ore",
            content: "Instagram permette di rispondere ai DM solo entro 24 ore dall'ultimo messaggio dell'utente. Dopo 24 ore, non puoi più inviare messaggi finché l'utente non scrive di nuovo. L'agente AI risponde automaticamente entro questa finestra.",
            warnings: ["Messaggi fuori dalla finestra 24h vengono messi in coda 'pending'", "L'utente deve scrivere per riaprire la finestra"],
            tips: ["Il sistema traccia automaticamente lo stato della finestra per ogni conversazione"]
          },
          {
            title: "Rate Limit 200 DM/Ora",
            content: "Meta impone un limite di 200 DM all'ora per account. Se superi questo limite, i messaggi vengono ritardati. Il sistema gestisce automaticamente la coda.",
            tips: ["Monitora le conversazioni attive per evitare di superare il limite"]
          },
          {
            title: "Collegamento con Agente WhatsApp",
            content: "Ogni configurazione Instagram è collegata a un Agente WhatsApp esistente. L'agente Instagram usa le stesse impostazioni: personalità, script, knowledge base, istruzioni AI. Non devi configurare l'AI due volte.",
            actionText: "Gestisci Agenti",
            actionHref: "/consultant/whatsapp"
          },
          {
            title: "Story Replies e Mentions",
            content: "L'agente può rispondere automaticamente quando qualcuno: 1) Risponde alle tue storie 2) Ti menziona nelle loro storie. Queste interazioni aprono una nuova finestra 24h.",
            tips: ["Le risposte alle storie sono ottime per engagement", "Configura risposte specifiche per story mentions"]
          },
          {
            title: "Comment-to-DM",
            content: "Funzionalità per inviare DM automatici quando qualcuno commenta un tuo post. Il flusso: Utente commenta → Sistema rileva → Invia DM automatico. Utile per lead generation da post.",
            tips: ["Configura parole chiave specifiche per attivare il DM", "Non spammare: invia DM solo per commenti rilevanti"]
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
    navigation: "Sidebar → FORMAZIONE → Università",
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
    navigation: "Sidebar → FORMAZIONE → Template",
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
    navigation: "Sidebar → FORMAZIONE → Esercizi",
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
    navigation: "Sidebar → FORMAZIONE → Corsi",
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

  aiCourseBuilder: {
    emoji: "🤖",
    title: "Crea Corso con AI",
    path: "/consultant/library/ai-builder",
    navigation: "Sidebar → FORMAZIONE → Corsi → Crea Corso con AI",
    description: "Crea corsi formativi automaticamente da video YouTube usando l'intelligenza artificiale. Estrai trascrizioni, genera lezioni e organizza in moduli.",
    category: "content",
    sections: [
      {
        title: "PANORAMICA",
        icon: "✨",
        description: "Il Corso Builder AI trasforma video YouTube in lezioni formative complete.",
        steps: [
          {
            title: "Come Funziona",
            content: "Inserisci link YouTube (singoli o playlist), l'AI estrae le trascrizioni e genera lezioni formative strutturate mantenendo lo stile e il tono dell'autore originale."
          },
          {
            title: "Vantaggi",
            content: "Risparmia ore di lavoro: l'AI crea automaticamente contenuti formativi da video esistenti, con struttura professionale e formattazione moderna.",
            tips: ["Ideale per trasformare webinar, corsi video o tutorial in lezioni testuali", "Supporta playlist intere per creare corsi multi-lezione"]
          },
          {
            title: "Accedere al Builder",
            content: "Vai su Libreria Formativa → clicca 'Crea Corso con AI' in alto a destra.",
            actionText: "Vai a Corsi",
            actionHref: "/consultant/library/ai-builder"
          }
        ]
      },
      {
        title: "STEP 1: IMPORTA VIDEO",
        icon: "📺",
        description: "Inserisci video YouTube da trasformare in lezioni.",
        steps: [
          {
            title: "Video Singoli",
            content: "Incolla uno o più link YouTube separati da virgola o su righe separate. L'AI estrae automaticamente titolo, durata e miniatura."
          },
          {
            title: "Playlist Intera",
            content: "Incolla il link di una playlist YouTube per importare tutti i video in un colpo solo."
          },
          {
            title: "Estrazione Trascrizioni",
            content: "L'AI tenta 3 metodi in sequenza: sottotitoli ufficiali YouTube → sottotitoli auto-generati → estrazione audio (richiede più tempo).",
            tips: ["I video con sottotitoli ufficiali danno risultati migliori", "La qualità della trascrizione viene valutata automaticamente"]
          },
          {
            title: "Rilevamento Duplicati",
            content: "Il sistema rileva automaticamente se un video è già stato importato in precedenza, mostrando dove esiste già la lezione corrispondente.",
            warnings: ["I duplicati vengono evidenziati per evitare di generare lezioni doppie"]
          }
        ]
      },
      {
        title: "STEP 2: SELEZIONA VIDEO",
        icon: "☑️",
        description: "Scegli quali video trasformare in lezioni.",
        steps: [
          {
            title: "Selezione Multipla",
            content: "Spunta i video che vuoi includere nel corso. Puoi selezionare/deselezionare tutti con un click."
          },
          {
            title: "Qualità Trascrizione",
            content: "Ogni video mostra un badge con la qualità della trascrizione: Ottima, Buona, Sufficiente, Scarsa. Preferisci video con qualità alta.",
            tips: ["Video senza trascrizione mostrano 'Da inserire' - puoi aggiungerla manualmente"]
          },
          {
            title: "Inserimento Manuale",
            content: "Se la trascrizione automatica non è disponibile o è di bassa qualità, clicca sull'icona 'modifica' per inserirla manualmente."
          }
        ]
      },
      {
        title: "STEP 3: IMPOSTAZIONI AI",
        icon: "⚙️",
        description: "Configura come l'AI genererà le lezioni.",
        steps: [
          {
            title: "Stile di Scrittura",
            content: "Scegli tra 10+ stili: Voce Originale (mantiene il tono dell'autore), Professionale, Conversazionale, Accademico, Narrativo, ecc."
          },
          {
            title: "Aggiunte Opzionali",
            content: "Attiva elementi extra: Punti Chiave, Esercizi Pratici, Domande di Riflessione, Citazioni, Glossario, Bibliografia.",
            tips: ["Ogni aggiunta arricchisce la lezione ma aumenta la lunghezza"]
          },
          {
            title: "Istruzioni AI Personalizzate",
            content: "Modifica le istruzioni AI per personalizzare ulteriormente l'output. Vedrai un'anteprima delle istruzioni che verranno usate."
          },
          {
            title: "Tema Visivo",
            content: "Scegli il tema grafico delle lezioni: Default, Elegante, Moderno, Minimalista, Accademico. Il tema influenza colori e stili delle lezioni generate."
          }
        ]
      },
      {
        title: "STEP 4: GENERAZIONE",
        icon: "⚡",
        description: "L'AI genera le lezioni in parallelo.",
        steps: [
          {
            title: "Elaborazione Batch",
            content: "L'AI genera 5 lezioni contemporaneamente per velocizzare il processo. Per 20 video servono circa 4 batch.",
            tips: ["Puoi vedere il progresso in tempo reale per ogni video", "I batch hanno una pausa di 2 secondi tra loro"]
          },
          {
            title: "Stati Video",
            content: "Ogni video mostra: In attesa → Generazione... (con animazione) → Completato ✓ oppure Errore ✗"
          },
          {
            title: "Salvataggio Automatico",
            content: "Il progresso viene salvato automaticamente dopo ogni batch. Se interrompi, puoi riprendere dalla bozza.",
            tips: ["Le bozze sono accessibili dalla pagina iniziale del builder", "Riprendendo, il sistema salta i video già generati"]
          },
          {
            title: "Lezioni Già Generate",
            content: "Se alcuni video hanno già lezioni esistenti, il sistema le include automaticamente senza rigenerarle."
          }
        ]
      },
      {
        title: "STEP 4.5: ORGANIZZAZIONE MODULI",
        icon: "📂",
        description: "Organizza le lezioni nei moduli del corso.",
        steps: [
          {
            title: "Modulo Singolo",
            content: "Seleziona un modulo esistente e assegna tutte le lezioni a quel modulo."
          },
          {
            title: "Organizzazione Manuale",
            content: "Assegna ogni lezione a un modulo specifico usando i dropdown. Utile per corsi strutturati."
          },
          {
            title: "Organizzazione AI",
            content: "Lascia che l'AI organizzi automaticamente le lezioni nei moduli più appropriati basandosi sui contenuti.",
            tips: ["L'AI analizza i titoli e contenuti per suggerire la migliore organizzazione"]
          },
          {
            title: "Crea Nuovo Modulo",
            content: "Puoi creare nuovi moduli direttamente da questa schermata se quelli esistenti non sono sufficienti."
          }
        ]
      },
      {
        title: "STEP 5: REVISIONE E PUBBLICAZIONE",
        icon: "📋",
        description: "Rivedi le lezioni e pubblica il corso.",
        steps: [
          {
            title: "Lista Lezioni",
            content: "Visualizza tutte le lezioni generate organizzate per modulo. Ogni lezione mostra titolo, modulo assegnato e miniatura video.",
            tips: ["Clicca su una lezione per vedere l'anteprima completa"]
          },
          {
            title: "Anteprima Lezione",
            content: "Apri l'anteprima per vedere come apparirà la lezione ai clienti. Verifica formattazione, contenuti e stile."
          },
          {
            title: "Riordina Lezioni",
            content: "Trascina le lezioni per cambiare l'ordine all'interno di ogni modulo."
          },
          {
            title: "Elimina Lezione",
            content: "Rimuovi singole lezioni prima della pubblicazione se non sono soddisfacenti."
          },
          {
            title: "Pubblica Tutto",
            content: "Clicca 'Pubblica X Lezioni' per rendere tutte le lezioni visibili ai clienti nella Libreria Formativa.",
            warnings: ["Una volta pubblicate, le lezioni sono immediatamente visibili ai clienti assegnati"]
          }
        ]
      },
      {
        title: "GESTIONE BOZZE",
        icon: "📝",
        description: "Come gestire e riprendere le bozze.",
        steps: [
          {
            title: "Bozze Automatiche",
            content: "Ogni sessione del builder crea automaticamente una bozza. Le bozze vengono aggiornate ad ogni batch completato."
          },
          {
            title: "Riprendere Bozza",
            content: "All'apertura del builder, se esiste una bozza interrotta, appare un popup per riprenderla. Clicca 'Continua' per riprendere da dove eri rimasto."
          },
          {
            title: "Lista Bozze",
            content: "Dalla pagina iniziale del builder, vedi tutte le bozze salvate con nome, data e progresso."
          },
          {
            title: "Eliminare Bozza",
            content: "Clicca l'icona cestino per eliminare una bozza non più necessaria."
          }
        ]
      },
      {
        title: "TROUBLESHOOTING",
        icon: "🔧",
        description: "Problemi comuni e soluzioni.",
        steps: [
          {
            title: "Video Senza Trascrizione",
            content: "Alcuni video non hanno sottotitoli. Soluzione: inserisci manualmente la trascrizione oppure usa l'estrazione audio (richiede più tempo).",
            tips: ["L'estrazione audio funziona ma è più lenta e meno precisa"]
          },
          {
            title: "Lezioni di Bassa Qualità",
            content: "Se la lezione generata non è soddisfacente, puoi eliminarla e rigenerarla con impostazioni diverse.",
            tips: ["Prova a cambiare stile di scrittura o aggiungere istruzioni specifiche"]
          },
          {
            title: "Generazione Interrotta",
            content: "Se la generazione si interrompe, usa la funzione 'Riprendi' dalla bozza. Il sistema ricomincia dal primo video non completato."
          },
          {
            title: "Duplicati Rilevati",
            content: "Se un video risulta duplicato, puoi: includere la lezione esistente senza rigenerare, eliminare la lezione esistente per rigenerare, oppure escludere il video."
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
    navigation: "Sidebar → BASE DI CONOSCENZA → Documenti",
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
    navigation: "Sidebar → BASE DI CONOSCENZA → API Esterne",
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
    navigation: "Sidebar → AI AVANZATO → File Search",
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
    navigation: "Sidebar → IMPOSTAZIONI → API Keys",
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
    navigation: "Sidebar → IMPOSTAZIONI → Profilo",
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
    navigation: "Sidebar → IMPOSTAZIONI → Calendario",
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
    navigation: "Sidebar → IMPOSTAZIONI → API Keys → Tab Email",
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
    navigation: "Sidebar → AI AVANZATO → Consulenze AI",
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
    navigation: "Sidebar → AI AVANZATO → Consulenze AI → Tab Echo",
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
    navigation: "Sidebar → LAVORO QUOTIDIANO → Clienti → [Dettaglio Cliente] → Roadmap",
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
    navigation: "Sidebar → GUIDE → Centro Guide",
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
  },

  // ═══════════════════════════════════════════════════════════════════
  // SEZIONE 10: NUOVE PAGINE - Aggiunte Dicembre 2025
  // ═══════════════════════════════════════════════════════════════════

  pathwayGenerator: {
    emoji: "🛤️",
    title: "Generatore Percorsi AI / Template Esercizi",
    path: "/consultant/exercise-templates",
    navigation: "Sidebar → FORMAZIONE → Template",
    description: "AI University Pathway Generator - wizard 4 step per creare percorsi formativi AI personalizzati. Genera automaticamente corsi, moduli e lezioni.",
    category: "content",
    sections: [
      {
        title: "WIZARD 4 STEP",
        icon: "🧙",
        description: "Processo guidato per creare percorsi formativi.",
        steps: [
          {
            title: "Step 1: Obiettivo",
            content: "Definisci l'obiettivo del percorso formativo e il target di riferimento."
          },
          {
            title: "Step 2: Argomenti",
            content: "Specifica gli argomenti principali da coprire nel percorso."
          },
          {
            title: "Step 3: Struttura",
            content: "L'AI propone una struttura di moduli e lezioni. Personalizza secondo le tue esigenze."
          },
          {
            title: "Step 4: Generazione",
            content: "Genera automaticamente i contenuti delle lezioni usando l'AI."
          }
        ]
      },
      {
        title: "PERSONALIZZAZIONE",
        icon: "✏️",
        description: "Modifica i contenuti generati.",
        steps: [
          {
            title: "Modifica Lezioni",
            content: "Ogni lezione generata può essere modificata prima della pubblicazione."
          },
          {
            title: "Aggiungi Esercizi",
            content: "Associa esercizi pratici alle lezioni generate."
          }
        ]
      }
    ]
  },

  whatsappAgentDetail: {
    emoji: "🤖",
    title: "Dettaglio Agente WhatsApp",
    path: "/consultant/whatsapp/agent/:agentId",
    navigation: "Sidebar → COMUNICAZIONE → I tuoi dipendenti → [Seleziona Agente]",
    description: "Configurazione dettagliata di un singolo agente WhatsApp. Modifica personalità, script, knowledge base e impostazioni avanzate.",
    category: "automation",
    sections: [
      {
        title: "CONFIGURAZIONE AGENTE",
        icon: "⚙️",
        description: "Impostazioni principali dell'agente.",
        steps: [
          {
            title: "Informazioni Base",
            content: "Nome, descrizione, tipo (inbound/outbound/consultative), stato attivo/pausa."
          },
          {
            title: "Personalità",
            content: "Definisci il tono, lo stile di comunicazione e le linee guida comportamentali."
          },
          {
            title: "Script Conversazione",
            content: "Configura il flusso della conversazione: saluto, qualifica, proposta, chiusura."
          },
          {
            title: "Knowledge Base",
            content: "Collega documenti e FAQ che l'agente può consultare per rispondere."
          }
        ]
      },
      {
        title: "IMPOSTAZIONI AVANZATE",
        icon: "🔧",
        description: "Configurazioni avanzate dell'agente.",
        steps: [
          {
            title: "Orari Attività",
            content: "Quando l'agente può rispondere. Fuori orario: messaggio automatico."
          },
          {
            title: "Google Calendar",
            content: "Collega un calendario per la prenotazione appuntamenti."
          },
          {
            title: "Categorie File Search",
            content: "Seleziona quali tipi di contenuti l'agente può usare nelle risposte."
          }
        ]
      }
    ]
  },

  // Guide specifiche del Centro Guide

  guideAgents: {
    emoji: "🤖",
    title: "Guida Agenti WhatsApp",
    path: "/consultant/guides/agents",
    navigation: "Sidebar → GUIDE → Centro Guide → Agenti WhatsApp",
    description: "Guida completa per creare e gestire gli agenti AI WhatsApp.",
    category: "core",
    sections: [
      {
        title: "INTRODUZIONE AGENTI",
        icon: "📖",
        description: "Tutto quello che devi sapere sugli agenti AI.",
        steps: [
          {
            title: "Cosa sono gli Agenti",
            content: "Gli agenti AI sono assistenti virtuali che gestiscono conversazioni WhatsApp automaticamente."
          },
          {
            title: "Tipi di Agenti",
            content: "Inbound (ricevono messaggi), Outbound (inviano proattivamente), Consultative (supporto)."
          },
          {
            title: "Come Crearli",
            content: "Vai su I tuoi dipendenti → Nuovo Agente e segui il wizard."
          }
        ]
      }
    ]
  },

  guideApiKeys: {
    emoji: "🔑",
    title: "Guida API Keys",
    path: "/consultant/guides/api-keys",
    navigation: "Sidebar → GUIDE → Centro Guide → API Keys",
    description: "Guida alla configurazione di tutte le API: Vertex AI, Twilio, Google, SMTP.",
    category: "core",
    sections: [
      {
        title: "CONFIGURAZIONE API",
        icon: "⚙️",
        description: "Come configurare ogni integrazione.",
        steps: [
          {
            title: "Vertex AI",
            content: "Configura l'AI principale: Project ID, Location, Credenziali JSON."
          },
          {
            title: "Twilio",
            content: "Per WhatsApp: Account SID, Auth Token, Numero WhatsApp."
          },
          {
            title: "Google",
            content: "Per Calendar: autorizza con OAuth2."
          },
          {
            title: "SMTP",
            content: "Per email: Host, Porta, Credenziali."
          }
        ]
      }
    ]
  },

  guideCampagne: {
    emoji: "📢",
    title: "Guida Campagne",
    path: "/consultant/guides/campagne",
    navigation: "Sidebar → GUIDE → Centro Guide → Campagne",
    description: "Guida completa per creare e gestire campagne marketing WhatsApp.",
    category: "core",
    sections: [
      {
        title: "CREARE CAMPAGNE",
        icon: "📖",
        description: "Come creare campagne efficaci.",
        steps: [
          {
            title: "Struttura Campagna",
            content: "Una campagna collega: Lead → Template WhatsApp → Agente AI."
          },
          {
            title: "L'Uncino",
            content: "La frase di apertura che cattura l'attenzione. Fondamentale per il successo."
          },
          {
            title: "Metriche",
            content: "Monitora: Delivery rate, Response rate, Conversion rate."
          }
        ]
      }
    ]
  },

  guideClients: {
    emoji: "👥",
    title: "Guida Gestione Clienti",
    path: "/consultant/guides/clients",
    navigation: "Sidebar → GUIDE → Centro Guide → Gestione Clienti",
    description: "Guida alla gestione completa dei clienti: profili, percorsi, documenti.",
    category: "core",
    sections: [
      {
        title: "GESTIONE CLIENTI",
        icon: "📖",
        description: "Come gestire i tuoi clienti.",
        steps: [
          {
            title: "Creare Clienti",
            content: "Vai su Clienti → Nuovo Cliente. Inserisci nome, email, obiettivi."
          },
          {
            title: "Profilo Cliente",
            content: "Visualizza storico consulenze, esercizi, documenti, progressi."
          },
          {
            title: "Azioni Rapide",
            content: "Prenota consulenza, assegna esercizio, invia email."
          }
        ]
      }
    ]
  },

  guideEmail: {
    emoji: "📧",
    title: "Guida Email Journey",
    path: "/consultant/guides/email",
    navigation: "Sidebar → GUIDE → Centro Guide → Email Journey",
    description: "Guida al sistema di email automatiche per il percorso clienti.",
    category: "core",
    sections: [
      {
        title: "EMAIL JOURNEY",
        icon: "📖",
        description: "Come funziona l'email journey.",
        steps: [
          {
            title: "Il Percorso 31 Giorni",
            content: "Ogni cliente riceve email automatiche basate sui template del giorno."
          },
          {
            title: "Template",
            content: "31 template personalizzabili: motivazionali, riflessione, azione."
          },
          {
            title: "Scheduler",
            content: "Configura frequenza e orario invio."
          }
        ]
      }
    ]
  },

  guideLeadHub: {
    emoji: "🎯",
    title: "Guida Lead Hub",
    path: "/consultant/guides/lead-hub",
    navigation: "Sidebar → GUIDE → Centro Guide → Lead Hub",
    description: "Guida al centro di controllo per l'acquisizione clienti.",
    category: "core",
    sections: [
      {
        title: "LEAD HUB",
        icon: "📖",
        description: "Come usare il Lead Hub.",
        steps: [
          {
            title: "Il Flusso",
            content: "Lead → Campagne → Template → Automazioni → Conversioni."
          },
          {
            title: "Importare Lead",
            content: "Carica da Excel/CSV o crea manualmente."
          },
          {
            title: "Lead Scoring",
            content: "Punteggio automatico basato su interazioni."
          }
        ]
      }
    ]
  },

  guideOverview: {
    emoji: "🌐",
    title: "Guida Panoramica",
    path: "/consultant/guides/overview",
    navigation: "Sidebar → GUIDE → Centro Guide → Panoramica",
    description: "Panoramica generale della piattaforma e delle sue funzionalità principali.",
    category: "core",
    sections: [
      {
        title: "PANORAMICA PIATTAFORMA",
        icon: "📖",
        description: "Introduzione alla piattaforma.",
        steps: [
          {
            title: "Cosa Offre",
            content: "Gestione clienti, formazione, WhatsApp automation, AI assistant, analytics."
          },
          {
            title: "Per Chi È",
            content: "Consulenti, coach, formatori che vogliono scalare il loro business."
          },
          {
            title: "Primi Passi",
            content: "Inizia dal Setup Wizard per configurare le integrazioni base."
          }
        ]
      }
    ]
  },

  guideTemplates: {
    emoji: "📝",
    title: "Guida Template",
    path: "/consultant/guides/templates",
    navigation: "Sidebar → GUIDE → Centro Guide → Template",
    description: "Guida ai template: esercizi, WhatsApp, email.",
    category: "core",
    sections: [
      {
        title: "TIPI DI TEMPLATE",
        icon: "📖",
        description: "I diversi template disponibili.",
        steps: [
          {
            title: "Template Esercizi",
            content: "Modelli riutilizzabili per assegnare esercizi ai clienti."
          },
          {
            title: "Template WhatsApp",
            content: "Messaggi pre-approvati da Meta per comunicazioni proattive."
          },
          {
            title: "Template Email",
            content: "I 31 template del journey email personalizzabili."
          }
        ]
      }
    ]
  },

  guideUniversity: {
    emoji: "🎓",
    title: "Guida Università",
    path: "/consultant/guides/university",
    navigation: "Sidebar → GUIDE → Centro Guide → Università",
    description: "Guida alla creazione e gestione dei corsi formativi.",
    category: "core",
    sections: [
      {
        title: "UNIVERSITY",
        icon: "📖",
        description: "Come creare corsi formativi.",
        steps: [
          {
            title: "Struttura Corsi",
            content: "Ogni corso contiene moduli, ogni modulo contiene lezioni."
          },
          {
            title: "Creare Lezioni",
            content: "Manualmente o con l'AI Course Builder da video YouTube."
          },
          {
            title: "Assegnare Corsi",
            content: "I clienti accedono ai corsi dalla loro area University."
          }
        ]
      }
    ]
  },

  guideWhatsapp: {
    emoji: "💚",
    title: "Guida WhatsApp",
    path: "/consultant/guides/whatsapp",
    navigation: "Sidebar → GUIDE → Centro Guide → WhatsApp",
    description: "Guida completa all'integrazione WhatsApp Business.",
    category: "core",
    sections: [
      {
        title: "WHATSAPP BUSINESS",
        icon: "📖",
        description: "Come usare WhatsApp Business API.",
        steps: [
          {
            title: "Configurazione Twilio",
            content: "Crea account Twilio, richiedi WhatsApp Business API, configura le credenziali."
          },
          {
            title: "Template Approvati",
            content: "Crea template e sottomettili a Meta per approvazione."
          },
          {
            title: "Agenti AI",
            content: "Crea agenti che rispondono automaticamente ai messaggi."
          },
          {
            title: "Campagne",
            content: "Invia messaggi proattivi a gruppi di lead."
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
