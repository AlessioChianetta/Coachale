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
  libraryGuide: Guide;
  profileGuide: Guide;
  dashboardGuide: Guide;
  aiAssistantGuide: Guide;
  setupWizardGuide: Guide;
  knowledgeBaseGuide: Guide;
  aiConsultationsGuide: Guide;
  templateGuide: Guide;
  proactiveLeadsGuide: Guide;
  whatsappAgentsGuide: Guide;
  apiKeysGuide: Guide;
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
        title: "CREARE UN NUOVO AGENTE WHATSAPP",
        icon: "🤖",
        description: "Come creare e configurare un agente AI WhatsApp da zero",
        steps: [
          {
            title: "Vai su Agenti WhatsApp",
            content: "COMUNICAZIONE & MARKETING → WhatsApp (URL: /consultant/whatsapp)",
            actionText: "Vai agli Agenti",
            actionHref: "/consultant/whatsapp"
          },
          {
            title: "Clicca 'Nuovo Agente'",
            content: "In alto trovi il bottone 'Nuovo Agente' o '+'. Clicca per avviare il wizard guidato in 4 step."
          },
          {
            title: "Step 1: Configurazione Base",
            content: "Nome agente: Come vuoi chiamare l'agente (es: 'Receptionist Marco')\n\nModalità integrazione (IMPORTANTE):\n🟢 WhatsApp + AI: Collegato a Twilio, riceve/invia messaggi reali\n🟣 Solo AI: Nessun Twilio, usato per chat interne/test"
          },
          {
            title: "Tipo di agente",
            content: "Scegli il comportamento dell'agente:\n\n📱 REATTIVO (Receptionist): Risponde ai messaggi in arrivo, qualifica lead, prenota appuntamenti\n🚀 PROATTIVO (Setter): Contatta lead proattivamente, fa follow-up automatici\n📚 EDUCATIVO (Advisor): Fornisce informazioni e contenuti formativi, NON prenota appuntamenti"
          },
          {
            title: "Credenziali Twilio (se WhatsApp + AI)",
            content: "Se scegli modalità 'WhatsApp + AI':\n- Account SID: Inizia con 'AC...'\n- Auth Token: Stringa lunga segreta\n- Numero WhatsApp: Formato +39...\n\nSe scegli 'Solo AI', questi campi non servono."
          }
        ]
      },
      {
        title: "STEP WIZARD AGENTE (2-3-4)",
        icon: "⚙️",
        description: "Configurazione avanzata negli step successivi del wizard",
        steps: [
          {
            title: "Step 2: Disponibilità",
            content: "Orari di lavoro: Imposta quando l'agente è attivo (es: Lun-Ven 9-18)\nMessaggio fuori orario: Cosa risponde dopo l'orario di lavoro\n\nFunzionalità:\n✅ Prenotazione appuntamenti (se calendario collegato)\n✅ Gestione obiezioni (risponde a dubbi)\n✅ Disqualificazione (esclude lead non in target)\n✅ Upselling (propone servizi aggiuntivi)\n✅ Risposte vocali (TTS con Gemini)"
          },
          {
            title: "Step 3: Brand Voice",
            content: "Informazioni azienda:\n- Nome business e descrizione\n- Bio consulente\n- Mission, Vision, Valori\n- USP (Unique Selling Proposition)\n- Chi aiuti e chi NON aiuti\n- Cosa fai e come lo fai\n\nCredibilità:\n- Anni esperienza\n- Clienti aiutati\n- Risultati generati\n- Case studies"
          },
          {
            title: "Step 4: Istruzioni AI",
            content: "Template predefiniti:\n🎯 Receptionist: Accoglie, qualifica, prenota\n🚀 Marco Setter: Proattivo, follow-up aggressivo\n📚 Educativo: Informativo, nessuna prenotazione\n\nPersonalità AI:\n- Amico fidato: Empatico e supportivo\n- Consulente esperto: Professionale e autorevole\n- Coach motivazionale: Energico e positivo"
          },
          {
            title: "Dry Run Mode",
            content: "Toggle 'Dry Run':\n✅ ON = Modalità test, messaggi simulati ma NON inviati\n❌ OFF = Modalità produzione, messaggi reali inviati\n\nConsiglio: Testa sempre con Dry Run ON prima di attivare l'invio reale."
          }
        ]
      },
      {
        title: "TIPI DI AGENTE SPIEGATI",
        icon: "📋",
        description: "Quando usare quale tipo di agente",
        steps: [
          {
            title: "📱 Agente REATTIVO (Receptionist)",
            content: "USO: Per rispondere a chi ti contatta spontaneamente\n\nCOMPORTAMENTO:\n- Aspetta messaggi in arrivo\n- Risponde automaticamente\n- Qualifica il lead con domande\n- Prenota appuntamenti nel calendario\n\nIDEALE PER: Landing page, QR code, campagne dove il lead inizia la conversazione"
          },
          {
            title: "🚀 Agente PROATTIVO (Marco Setter)",
            content: "USO: Per contattare lead che hai importato\n\nCOMPORTAMENTO:\n- Invia primo messaggio programmato\n- Fa follow-up automatici\n- Usa template personalizzati\n- Persiste fino a risposta o disqualificazione\n\nIDEALE PER: Lead da form, Facebook Ads, liste importate"
          },
          {
            title: "📚 Agente EDUCATIVO (Advisor)",
            content: "USO: Per fornire informazioni senza vendere\n\nCOMPORTAMENTO:\n- Risponde a domande informative\n- Fornisce contenuti formativi\n- NON prenota appuntamenti\n- NON fa vendita aggressiva\n\nIDEALE PER: Supporto clienti esistenti, FAQ automatiche, contenuti educativi"
          },
          {
            title: "Modalità Integrazione: WhatsApp+AI vs Solo AI",
            content: "🟢 WHATSAPP + AI (Richiede Twilio):\n- Riceve messaggi WhatsApp reali\n- Invia risposte automatiche\n- Serve numero WhatsApp Business\n- Per comunicazione con clienti reali\n\n🟣 SOLO AI (Senza Twilio):\n- Chat interna solo nell'app\n- Per test e simulazioni\n- Per usare AI senza WhatsApp\n- Nessuna credenziale richiesta"
          }
        ]
      },
      {
        title: "CHAT CON GLI AGENTI (TEST E CONVERSAZIONI)",
        icon: "💬",
        description: "Come chattare direttamente con i tuoi agenti AI e vedere le conversazioni",
        steps: [
          {
            title: "Vai su Chat Agenti",
            content: "COMUNICAZIONE & MARKETING → WhatsApp - Chat Agenti (URL: /consultant/whatsapp/agents/chat)",
            actionText: "Vai alla Chat",
            actionHref: "/consultant/whatsapp/agents/chat"
          },
          {
            title: "Seleziona un agente",
            content: "Nella colonna sinistra vedi la lista dei tuoi agenti. Clicca su uno per selezionarlo."
          },
          {
            title: "Visualizza conversazioni",
            content: "Per ogni agente vedi due tab:\n📱 Interne: Conversazioni di test fatte da te\n🌐 Pubbliche: Conversazioni reali con clienti/visitatori"
          },
          {
            title: "Inizia nuova chat",
            content: "Clicca 'Nuova Chat' per iniziare una conversazione di test con l'agente. Utile per verificare che risponda correttamente prima di attivarlo."
          },
          {
            title: "Invia messaggi",
            content: "Scrivi il messaggio e clicca Invia. L'agente risponde in tempo reale usando le istruzioni configurate.\n\n📎 Puoi allegare immagini\n🎤 Puoi inviare messaggi vocali"
          },
          {
            title: "Condividi agente",
            content: "Clicca icona 'Condividi' per creare un link pubblico. I visitatori potranno chattare con l'agente senza login. Utile per landing page e demo."
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
        title: "CONSULENZE AI SETTIMANALI",
        icon: "🤖",
        description: "Sessioni vocali AI programmate per i clienti",
        steps: [
          {
            title: "Vai su Consulenze AI",
            content: "GESTIONE CLIENTI → Consulenze AI (URL: /consultant/ai-consultations)",
            actionText: "Vai alle Consulenze AI",
            actionHref: "/consultant/ai-consultations"
          },
          {
            title: "Crea nuova consulenza",
            content: "Clicca 'Nuova Consulenza AI'. Seleziona:\n- Cliente: Chi parteciperà alla sessione\n- Data/ora: Quando sarà disponibile\n- Durata massima: Da 30 minuti a 3 ore"
          },
          {
            title: "Modalità test",
            content: "Toggle 'Modalità Test':\n✅ ON = Sessione di prova, per verificare funzionamento\n❌ OFF = Sessione reale con il cliente"
          },
          {
            title: "Stati della consulenza",
            content: "📅 Programmata: In attesa, il cliente può accedere all'orario\n🟢 In Corso: Sessione attiva, cliente sta parlando con AI\n✅ Completata: Sessione terminata\n❌ Cancellata: Annullata"
          },
          {
            title: "Come funziona per il cliente",
            content: "Il cliente accede alla sua area e trova la consulenza AI disponibile. Può parlare vocalmente con l'AI che risponde in tempo reale usando le informazioni del suo profilo, stato, obiettivi e progressi."
          },
          {
            title: "Gestisci consulenze",
            content: "Puoi modificare data/ora o eliminare consulenze programmate. Le consulenze completate restano come storico."
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
  },

  libraryGuide: {
    title: "Libreria Corsi & Documenti",
    path: "/consultant/library",
    emoji: "📚",
    description: "Sistema per creare corsi, moduli e documenti formativi da assegnare ai clienti",
    sections: [
      {
        title: "CREARE UN NUOVO CORSO (CATEGORIA)",
        icon: "📖",
        description: "Come creare un corso formativo nella libreria",
        steps: [
          {
            title: "Vai sulla Libreria",
            content: "FORMAZIONE → Libreria Corsi (URL: /consultant/library)",
            actionText: "Vai alla Libreria",
            actionHref: "/consultant/library"
          },
          {
            title: "Clicca 'Nuovo Corso'",
            content: "In alto a destra trovi il bottone 'Nuovo Corso' (o 'Nuova Categoria'). Clicca per aprire il form."
          },
          {
            title: "Compila i dati del corso",
            content: "Nome: Titolo del corso (es: 'Leadership & Gestione Team')\nDescrizione: Breve descrizione del contenuto\nIcona: Scegli un'icona rappresentativa\nColore: Scegli un colore per identificare il corso"
          },
          {
            title: "Salva il corso",
            content: "Clicca 'Salva'. Il corso apparirà nella lista. Ora puoi aggiungere sottocategorie e documenti."
          }
        ]
      },
      {
        title: "CREARE SOTTOCATEGORIE (MODULI)",
        icon: "📁",
        description: "Come organizzare i contenuti in moduli dentro un corso",
        steps: [
          {
            title: "Seleziona un corso",
            content: "Dalla lista corsi, clicca sul corso dove vuoi aggiungere una sottocategoria."
          },
          {
            title: "Clicca 'Nuova Sottocategoria'",
            content: "All'interno del corso, trovi il bottone 'Nuova Sottocategoria' o 'Nuovo Modulo'."
          },
          {
            title: "Compila i dati",
            content: "Nome: Nome del modulo (es: 'Modulo 1 - Fondamenti')\nDescrizione: Cosa insegna questo modulo\nIcona e Colore: Personalizza l'aspetto\nOrdine: Imposta la posizione nella lista"
          },
          {
            title: "Struttura consigliata",
            content: "Organizza i moduli in ordine logico:\n1. Modulo introduttivo\n2. Moduli intermedi\n3. Modulo avanzato/conclusivo"
          }
        ]
      },
      {
        title: "CREARE DOCUMENTI (LEZIONI)",
        icon: "📝",
        description: "Come creare contenuti formativi dentro un modulo",
        steps: [
          {
            title: "Seleziona la sottocategoria",
            content: "Entra nella sottocategoria dove vuoi aggiungere il documento."
          },
          {
            title: "Clicca 'Nuovo Documento'",
            content: "Trovi il bottone 'Nuovo Documento' o 'Nuova Lezione'."
          },
          {
            title: "Scegli tipo contenuto",
            content: "Scegli tra 3 tipi:\n📄 Testo: Articoli, guide scritte\n🎥 Video: Link YouTube/Vimeo\n📄+🎥 Entrambi: Testo + Video insieme"
          },
          {
            title: "Compila i campi",
            content: "Titolo: Nome della lezione\nSottotitolo: Descrizione breve\nContenuto: Testo formattato (supporta grassetto, liste, titoli)\nURL Video: Link al video (se tipo Video o Entrambi)\nLivello: Base, Intermedio o Avanzato\nDurata stimata: Tempo per completare\nTag: Parole chiave per ricerca"
          },
          {
            title: "Pubblica o salva bozza",
            content: "Toggle 'Pubblicato':\n✅ ON = Visibile ai clienti assegnati\n❌ OFF = Bozza, non visibile"
          }
        ]
      },
      {
        title: "ASSEGNARE CORSI AI CLIENTI",
        icon: "👥",
        description: "Come dare accesso ai corsi ai tuoi clienti",
        steps: [
          {
            title: "Vai sul corso da assegnare",
            content: "Nella lista corsi, trova quello che vuoi assegnare."
          },
          {
            title: "Clicca icona 'Assegna'",
            content: "Accanto al corso trovi l'icona utenti (👥). Clicca per aprire il pannello assegnazioni."
          },
          {
            title: "Seleziona i clienti",
            content: "Vedi lista clienti attivi. Spunta quelli che devono avere accesso al corso."
          },
          {
            title: "Conferma assegnazione",
            content: "Clicca 'Salva Assegnazioni'. I clienti selezionati vedranno il corso nella loro area formazione."
          },
          {
            title: "Verifica accessi",
            content: "Il numero di clienti assegnati appare come badge sul corso (es: '5 clienti')."
          }
        ]
      },
      {
        title: "LIVELLI DOCUMENTO",
        icon: "📊",
        description: "Come funziona il sistema di livelli",
        steps: [
          {
            title: "Livelli disponibili",
            content: "🟢 Base: Contenuti introduttivi, accessibili a tutti\n🟡 Intermedio: Approfondimenti, richiede conoscenze base\n🔴 Avanzato: Contenuti esperti, per clienti avanzati"
          },
          {
            title: "Filtrare per livello",
            content: "Nella libreria puoi filtrare documenti per livello usando il filtro 'Livello' in alto."
          },
          {
            title: "Uso consigliato",
            content: "Usa i livelli per guidare il percorso del cliente:\n1. Parti con contenuti Base\n2. Prosegui con Intermedi dopo esercizi completati\n3. Sblocca Avanzati per clienti che dimostrano padronanza"
          }
        ]
      },
      {
        title: "RICERCA E FILTRI",
        icon: "🔍",
        description: "Come trovare documenti nella libreria",
        steps: [
          {
            title: "Barra di ricerca",
            content: "In alto trovi la barra di ricerca. Cerca per titolo, descrizione o tag dei documenti."
          },
          {
            title: "Filtro per corso",
            content: "Seleziona un corso specifico per vedere solo i suoi contenuti."
          },
          {
            title: "Filtro per sottocategoria",
            content: "Dopo aver selezionato un corso, filtra ulteriormente per sottocategoria/modulo."
          },
          {
            title: "Filtro per livello",
            content: "Filtra per livello (Base/Intermedio/Avanzato) per trovare contenuti specifici."
          }
        ]
      }
    ]
  },

  profileGuide: {
    title: "Profilo Consulente",
    path: "/consultant/profile-settings",
    emoji: "👤",
    description: "Gestisci le tue informazioni personali e abilita il riconoscimento WhatsApp",
    sections: [
      {
        title: "MODIFICARE IL PROFILO",
        icon: "✏️",
        description: "Come aggiornare le tue informazioni personali",
        steps: [
          {
            title: "Vai su Impostazioni Profilo",
            content: "CONFIGURAZIONE → Profilo Consulente (URL: /consultant/profile-settings)",
            actionText: "Vai al Profilo",
            actionHref: "/consultant/profile-settings"
          },
          {
            title: "Modifica i campi",
            content: "Puoi modificare:\n👤 Nome: Il tuo nome\n👤 Cognome: Il tuo cognome\n📧 Email: La tua email di contatto\n📱 Telefono: Il tuo numero WhatsApp (opzionale ma consigliato)"
          },
          {
            title: "Salva le modifiche",
            content: "Clicca 'Salva' in basso. Le modifiche sono immediate."
          }
        ]
      },
      {
        title: "INTEGRAZIONE WHATSAPP CONSULENTE",
        icon: "💬",
        description: "Come essere riconosciuto come consulente su WhatsApp",
        steps: [
          {
            title: "Perché inserire il telefono",
            content: "Se inserisci il tuo numero di telefono, quando scrivi da WhatsApp al sistema verrai riconosciuto come consulente."
          },
          {
            title: "Cosa significa essere riconosciuto",
            content: "Quando scrivi da WhatsApp:\n✅ L'AI sa che sei il consulente\n✅ Hai accesso a tutti i dati dei clienti\n✅ Puoi chiedere info su appuntamenti, esercizi, progressi\n✅ È come usare l'app web, ma da WhatsApp"
          },
          {
            title: "Formato numero corretto",
            content: "Inserisci il numero in formato italiano:\n+393501234567 (con prefisso +39)\noppure 3501234567 (senza prefisso)\nIl sistema normalizza automaticamente."
          },
          {
            title: "Test riconoscimento",
            content: "Dopo aver salvato, scrivi da WhatsApp al tuo agente AI. Dovresti ricevere una risposta che ti riconosce come consulente con accesso ai dati."
          }
        ]
      },
      {
        title: "PRIVACY E SICUREZZA",
        icon: "🔐",
        description: "Come vengono gestiti i tuoi dati",
        steps: [
          {
            title: "Dati protetti",
            content: "Le tue informazioni personali sono criptate e accessibili solo a te."
          },
          {
            title: "Email verificata",
            content: "L'email del tuo account è quella usata per il login. Non può essere cambiata da questa pagina per sicurezza."
          },
          {
            title: "Numero telefono opzionale",
            content: "Il numero di telefono è opzionale. Se non lo inserisci, il sistema funziona normalmente ma non potrai essere riconosciuto via WhatsApp."
          }
        ]
      }
    ]
  },

  dashboardGuide: {
    title: "Dashboard Consulente",
    path: "/consultant",
    emoji: "📊",
    description: "Panoramica completa delle metriche, clienti e appuntamenti del tuo business",
    sections: [
      {
        title: "PANORAMICA METRICHE",
        icon: "📈",
        description: "Capire i numeri chiave del tuo business",
        steps: [
          {
            title: "Accedi alla Dashboard",
            content: "La Dashboard è la homepage quando accedi come consulente. Vai su PRINCIPALE → Dashboard (URL: /consultant)",
            actionText: "Vai alla Dashboard",
            actionHref: "/consultant"
          },
          {
            title: "Clienti Attivi",
            content: "In alto vedi il conteggio dei clienti attivi. Sono i clienti che stanno attualmente seguendo un percorso formativo."
          },
          {
            title: "Appuntamenti Oggi/Settimana",
            content: "Visualizza rapidamente quanti appuntamenti hai programmati oggi e questa settimana. Clicca per andare al calendario."
          },
          {
            title: "Esercizi in Attesa",
            content: "Numero di esercizi inviati dai clienti che aspettano la tua valutazione. Clicca per revisonarli."
          },
          {
            title: "Lead Attivi",
            content: "Conteggio dei lead in gestione tramite WhatsApp. Include lead pending, contacted e responded."
          }
        ]
      },
      {
        title: "WIDGET STATISTICHE",
        icon: "📉",
        description: "Grafici e analytics del tuo lavoro",
        steps: [
          {
            title: "Grafico Trend Clienti",
            content: "Mostra l'andamento del numero di clienti negli ultimi mesi. Utile per capire la crescita del business."
          },
          {
            title: "Tasso di Conversione Lead",
            content: "Percentuale di lead che diventano clienti. Monitora l'efficacia delle tue campagne WhatsApp."
          },
          {
            title: "Completamento Esercizi",
            content: "Percentuale di esercizi completati vs assegnati. Indica quanto i clienti sono engaged nel percorso."
          },
          {
            title: "Attività Recenti",
            content: "Feed delle ultime azioni: nuovi clienti, esercizi inviati, appuntamenti completati."
          }
        ]
      },
      {
        title: "OVERVIEW CLIENTI E APPUNTAMENTI",
        icon: "👥",
        description: "Accesso rapido alle informazioni più importanti",
        steps: [
          {
            title: "Lista Clienti Prioritari",
            content: "Vedi i clienti che richiedono attenzione immediata: quelli inattivi, con esercizi in ritardo, o che non rispondono."
          },
          {
            title: "Prossimi Appuntamenti",
            content: "Lista dei prossimi appuntamenti con data, ora e nome cliente. Clicca per vedere i dettagli."
          },
          {
            title: "Quick Actions",
            content: "Bottoni rapidi per le azioni più comuni:\n- Nuovo Cliente\n- Nuovo Appuntamento\n- Assegna Esercizio\n- Invia Email"
          },
          {
            title: "Stato Sistema",
            content: "Indicatori sullo stato delle integrazioni: WhatsApp connesso, SMTP configurato, AI attivo."
          }
        ]
      }
    ]
  },

  aiAssistantGuide: {
    title: "AI Assistant",
    path: "/consultant/ai-assistant",
    emoji: "🤖",
    description: "Il tuo assistente AI personale per gestire clienti, trovare informazioni e automatizzare task",
    sections: [
      {
        title: "COME CHATTARE CON L'AI",
        icon: "💬",
        description: "Iniziare una conversazione con l'assistente",
        steps: [
          {
            title: "Accedi all'AI Assistant",
            content: "PRINCIPALE → AI Assistant (URL: /consultant/ai-assistant)",
            actionText: "Apri AI Assistant",
            actionHref: "/consultant/ai-assistant"
          },
          {
            title: "Scrivi la tua domanda",
            content: "Nella casella di testo in basso, scrivi quello che vuoi sapere o fare. Puoi usare linguaggio naturale, come se parlassi con un collega."
          },
          {
            title: "Attendi la risposta",
            content: "L'AI elabora la richiesta e risponde in pochi secondi. Se usa dati del sistema (clienti, appuntamenti, ecc.), li recupera automaticamente."
          },
          {
            title: "Continua la conversazione",
            content: "Puoi fare domande di follow-up. L'AI ricorda il contesto della conversazione corrente."
          }
        ]
      },
      {
        title: "FUNZIONALITÀ DISPONIBILI",
        icon: "⚡",
        description: "Cosa può fare l'AI Assistant per te",
        steps: [
          {
            title: "Informazioni Clienti",
            content: "Chiedi info su qualsiasi cliente:\n- 'Come sta andando Mario Rossi?'\n- 'Quanti esercizi ha completato Laura?'\n- 'Qual è lo stato del cliente X?'"
          },
          {
            title: "Gestione Appuntamenti",
            content: "Chiedi informazioni sugli appuntamenti:\n- 'Che appuntamenti ho oggi?'\n- 'Chi devo vedere questa settimana?'\n- 'Quando è il prossimo appuntamento con Paolo?'"
          },
          {
            title: "Analisi e Report",
            content: "Richiedi analisi aggregate:\n- 'Quanti clienti attivi ho?'\n- 'Qual è il tasso di completamento esercizi?'\n- 'Chi sono i clienti meno attivi?'"
          },
          {
            title: "Navigazione Assistita",
            content: "Chiedi dove trovare le cose:\n- 'Come configuro WhatsApp?'\n- 'Dove imposto le email automatiche?'\n- 'Come creo un nuovo corso?'"
          },
          {
            title: "Suggerimenti Proattivi",
            content: "L'AI può suggerirti azioni:\n- 'Chi dovrei contattare oggi?'\n- 'Quali clienti hanno bisogno di attenzione?'\n- 'Cosa dovrei fare adesso?'"
          }
        ]
      },
      {
        title: "COMANDI E SUGGERIMENTI",
        icon: "💡",
        description: "Come ottenere il massimo dall'AI",
        steps: [
          {
            title: "Sii specifico",
            content: "Più dettagli dai, migliore sarà la risposta. Invece di 'parlami del cliente', chiedi 'qual è lo stato degli esercizi di Mario Rossi?'"
          },
          {
            title: "Usa nomi completi",
            content: "Quando chiedi di un cliente specifico, usa nome e cognome per evitare ambiguità."
          },
          {
            title: "Quick Actions",
            content: "Usa i bottoni rapidi sotto la chat per azioni comuni senza dover scrivere:\n- 📅 Appuntamenti oggi\n- 👥 Clienti prioritari\n- 📝 Esercizi in attesa"
          },
          {
            title: "Storico Conversazioni",
            content: "Le conversazioni precedenti sono salvate. Puoi rivederle cliccando su 'Storico' nella barra laterale."
          },
          {
            title: "Reset Conversazione",
            content: "Clicca 'Nuova Chat' per iniziare una conversazione pulita senza contesto precedente."
          }
        ]
      }
    ]
  },

  setupWizardGuide: {
    title: "Setup Iniziale",
    path: "/consultant/setup-wizard",
    emoji: "🚀",
    description: "Wizard guidato per configurare tutte le integrazioni del sistema in 4 semplici fasi",
    sections: [
      {
        title: "LE 4 FASI DI CONFIGURAZIONE",
        icon: "📋",
        description: "Panoramica del processo di setup",
        steps: [
          {
            title: "Accedi al Setup Wizard",
            content: "PRINCIPALE → Setup Iniziale (URL: /consultant/setup-wizard)",
            actionText: "Avvia Setup",
            actionHref: "/consultant/setup-wizard"
          },
          {
            title: "Fase 1: Profilo Consulente",
            content: "Configura le tue informazioni personali:\n- Nome e Cognome\n- Email di contatto\n- Numero WhatsApp (per essere riconosciuto)\n- Bio e descrizione servizi"
          },
          {
            title: "Fase 2: Intelligenza Artificiale",
            content: "Configura il provider AI:\n- Scegli tra Vertex AI o Google AI Studio\n- Inserisci le credenziali (Project ID, API Key)\n- Testa la connessione AI"
          },
          {
            title: "Fase 3: Email & SMTP",
            content: "Configura l'invio email automatico:\n- Server SMTP (Gmail, Outlook, altro)\n- Credenziali email\n- Firma e tono delle email\n- Test invio"
          },
          {
            title: "Fase 4: WhatsApp & Twilio",
            content: "Configura la messaggistica WhatsApp:\n- Account Twilio (SID e Token)\n- Numero WhatsApp Business\n- Webhook configurazione\n- Test invio messaggio"
          }
        ]
      },
      {
        title: "PREREQUISITI E VERIFICHE",
        icon: "✅",
        description: "Cosa ti serve prima di iniziare",
        steps: [
          {
            title: "Account Google Cloud (per Vertex AI)",
            content: "Se vuoi usare Vertex AI:\n1. Crea progetto su Google Cloud Console\n2. Abilita Vertex AI API\n3. Crea Service Account con ruoli corretti\n4. Scarica JSON delle credenziali"
          },
          {
            title: "API Key Google AI Studio (alternativa)",
            content: "Per Google AI Studio (più semplice):\n1. Vai su aistudio.google.com\n2. Clicca 'Get API Key'\n3. Copia la chiave generata"
          },
          {
            title: "Account Email con SMTP",
            content: "Per Gmail:\n1. Attiva verifica in 2 passaggi\n2. Genera 'Password per le app'\n3. Usa quella password nel wizard"
          },
          {
            title: "Account Twilio",
            content: "Per WhatsApp:\n1. Registrati su twilio.com\n2. Dalla dashboard copia Account SID e Auth Token\n3. Acquista o configura numero WhatsApp\n4. (Opzionale) Usa sandbox per test"
          }
        ]
      },
      {
        title: "TEST DELLE CONNESSIONI",
        icon: "🔌",
        description: "Verificare che tutto funzioni",
        steps: [
          {
            title: "Test AI",
            content: "Clicca 'Test Connessione' dopo aver inserito le credenziali AI. Deve mostrare ✅ verde con il messaggio 'Connessione riuscita'."
          },
          {
            title: "Test Email",
            content: "Clicca 'Invia Email di Test'. Riceverai un'email all'indirizzo configurato. Controlla anche la cartella spam."
          },
          {
            title: "Test WhatsApp",
            content: "Clicca 'Invia Messaggio Test'. Riceverai un messaggio WhatsApp al numero configurato. Se usi sandbox, assicurati di aver attivato il numero."
          },
          {
            title: "Indicatori di Stato",
            content: "Ogni fase mostra un indicatore:\n🔴 Rosso = Non configurato\n🟡 Giallo = Configurato ma non testato\n🟢 Verde = Configurato e funzionante"
          },
          {
            title: "Completamento Setup",
            content: "Quando tutte le fasi sono verdi, il setup è completo. Puoi sempre tornare per modificare le configurazioni."
          }
        ]
      }
    ]
  },

  knowledgeBaseGuide: {
    title: "Knowledge Base",
    path: "/consultant/knowledge-documents",
    emoji: "📚",
    description: "Carica documenti e configura API per arricchire le conoscenze dell'AI sui tuoi servizi",
    sections: [
      {
        title: "CARICARE DOCUMENTI",
        icon: "📄",
        description: "Come aggiungere documenti alla knowledge base",
        steps: [
          {
            title: "Vai su Knowledge Documenti",
            content: "BASE DI CONOSCENZA → Documenti (URL: /consultant/knowledge-documents)",
            actionText: "Gestisci Documenti",
            actionHref: "/consultant/knowledge-documents"
          },
          {
            title: "Clicca 'Carica Documento'",
            content: "In alto a destra trovi il bottone per caricare nuovi documenti."
          },
          {
            title: "Formati supportati",
            content: "Puoi caricare:\n📄 PDF - Documenti, brochure, contratti\n📝 TXT - File di testo semplice\n📊 DOCX - Documenti Word\n📋 CSV/XLSX - Fogli di calcolo"
          },
          {
            title: "Aggiungi titolo e descrizione",
            content: "Dai un nome significativo al documento e una breve descrizione del contenuto. Questo aiuta l'AI a capire quando usarlo."
          },
          {
            title: "Seleziona categoria",
            content: "Organizza i documenti per categoria:\n- Servizi e Prodotti\n- FAQ e Obiezioni\n- Case Studies\n- Procedure Interne"
          },
          {
            title: "Elaborazione automatica",
            content: "Dopo il caricamento, il sistema estrae e indicizza il testo. L'AI potrà poi usare queste informazioni nelle risposte."
          }
        ]
      },
      {
        title: "CONFIGURARE API ESTERNE",
        icon: "🔗",
        description: "Collegare fonti dati esterne all'AI",
        steps: [
          {
            title: "Vai su Knowledge API",
            content: "BASE DI CONOSCENZA → API Esterne (URL: /consultant/knowledge-apis)",
            actionText: "Configura API",
            actionHref: "/consultant/knowledge-apis"
          },
          {
            title: "Clicca 'Nuova API'",
            content: "Aggiungi una nuova fonte dati esterna che l'AI può interrogare."
          },
          {
            title: "Configura endpoint",
            content: "Inserisci:\n- Nome: Identificativo della fonte\n- URL: Endpoint dell'API\n- Metodo: GET o POST\n- Headers: Autenticazione (API Key, Bearer Token)"
          },
          {
            title: "Mappa i campi",
            content: "Indica quali campi della risposta JSON contengono le informazioni utili. Es: 'data.products[].name' per estrarre nomi prodotti."
          },
          {
            title: "Imposta trigger",
            content: "Definisci quando l'AI deve interrogare questa API:\n- Parole chiave nella domanda\n- Tipo di richiesta utente\n- Sempre (per dati in tempo reale)"
          },
          {
            title: "Test API",
            content: "Clicca 'Test' per verificare che l'API risponda correttamente e che i campi siano mappati bene."
          }
        ]
      },
      {
        title: "COME L'AI USA I DOCUMENTI",
        icon: "🧠",
        description: "Capire come funziona la knowledge base",
        steps: [
          {
            title: "Ricerca Semantica",
            content: "Quando l'utente fa una domanda, l'AI cerca nei documenti le sezioni più rilevanti usando la comprensione del significato, non solo parole chiave."
          },
          {
            title: "Contesto Automatico",
            content: "I pezzi di documento rilevanti vengono automaticamente inclusi nel contesto dell'AI, permettendole di rispondere con informazioni accurate."
          },
          {
            title: "Citazioni",
            content: "Quando l'AI usa informazioni da un documento, può citare la fonte. Questo aumenta la trasparenza e l'affidabilità delle risposte."
          },
          {
            title: "Priorità Documenti",
            content: "Puoi impostare una priorità per ogni documento. Quelli con priorità alta vengono consultati prima."
          },
          {
            title: "Aggiornamenti",
            content: "Quando aggiorni un documento, la knowledge base si aggiorna automaticamente. Le nuove informazioni sono subito disponibili all'AI."
          },
          {
            title: "Best Practices",
            content: "Per risultati ottimali:\n- Documenti chiari e ben strutturati\n- Titoli descrittivi\n- Contenuto suddiviso in sezioni\n- Aggiornamenti regolari"
          }
        ]
      }
    ]
  },

  aiConsultationsGuide: {
    title: "Consulenze AI",
    path: "/consultant/ai-consultations",
    emoji: "🎯",
    description: "Sistema di consulenze automatiche AI per qualificare lead e fornire prime informazioni",
    sections: [
      {
        title: "COSA SONO LE CONSULENZE AI",
        icon: "💡",
        description: "Capire il concetto di consulenza automatica",
        steps: [
          {
            title: "Definizione",
            content: "Le Consulenze AI sono conversazioni strutturate tra l'AI e potenziali clienti (lead). L'AI raccoglie informazioni, risponde a domande e qualifica il lead."
          },
          {
            title: "Quando vengono attivate",
            content: "Una consulenza AI si attiva quando:\n- Un lead clicca su un link di consulenza\n- Un visitatore interagisce con il chatbot sul sito\n- Un utente risponde a una campagna WhatsApp"
          },
          {
            title: "Obiettivi della consulenza",
            content: "L'AI mira a:\n- Capire le esigenze del lead\n- Fornire informazioni sui tuoi servizi\n- Rispondere a obiezioni comuni\n- Qualificare il lead (hot/warm/cold)\n- Prenotare un appuntamento se appropriato"
          },
          {
            title: "Vantaggi",
            content: "✅ Disponibilità 24/7\n✅ Risposte immediate\n✅ Qualificazione automatica\n✅ Risparmio tempo consulente\n✅ Scalabilità infinita"
          }
        ]
      },
      {
        title: "COME FUNZIONANO",
        icon: "⚙️",
        description: "Il processo dietro le consulenze AI",
        steps: [
          {
            title: "Accesso Consulenze",
            content: "AI AVANZATO → Consulenze AI (URL: /consultant/ai-consultations)",
            actionText: "Vai alle Consulenze",
            actionHref: "/consultant/ai-consultations"
          },
          {
            title: "Flusso della conversazione",
            content: "1. Lead inizia la chat\n2. AI si presenta e chiede come può aiutare\n3. Lead espone esigenza/problema\n4. AI fa domande di approfondimento\n5. AI fornisce info rilevanti (dalla knowledge base)\n6. Se qualificato, propone appuntamento"
          },
          {
            title: "Uso della Knowledge Base",
            content: "L'AI usa automaticamente i documenti caricati per rispondere alle domande. Più documenti hai, più accurate saranno le risposte."
          },
          {
            title: "Qualificazione Lead",
            content: "Durante la consulenza, l'AI assegna un punteggio:\n🔥 Hot: Molto interessato, pronto all'azione\n🟠 Warm: Interessato ma ha dubbi\n🔵 Cold: Curioso ma non pronto"
          },
          {
            title: "Handoff al Consulente",
            content: "Se il lead è qualificato e vuole parlare con te, l'AI può:\n- Prenotare un appuntamento nel calendario\n- Inoltrarti la conversazione\n- Inviarti notifica immediata"
          }
        ]
      },
      {
        title: "VISUALIZZARE LO STORICO",
        icon: "📜",
        description: "Accedere alle consulenze passate",
        steps: [
          {
            title: "Lista Consulenze",
            content: "Nella pagina Consulenze AI vedi la lista di tutte le consulenze effettuate, ordinate per data."
          },
          {
            title: "Filtri disponibili",
            content: "Filtra per:\n- Data (oggi, settimana, mese)\n- Stato qualificazione (Hot/Warm/Cold)\n- Esito (Appuntamento prenotato, Solo info, Abbandono)"
          },
          {
            title: "Dettaglio Conversazione",
            content: "Clicca su una consulenza per vedere l'intera conversazione tra AI e lead. Vedi ogni messaggio scambiato."
          },
          {
            title: "Metriche Consulenza",
            content: "Per ogni consulenza vedi:\n- Durata conversazione\n- Numero messaggi scambiati\n- Punteggio qualificazione\n- Documenti knowledge usati"
          },
          {
            title: "Export Dati",
            content: "Puoi esportare i dati delle consulenze in CSV per analisi esterne o reportistica."
          },
          {
            title: "Insights Aggregati",
            content: "Dashboard con metriche aggregate:\n- Consulenze totali\n- Tasso di qualificazione\n- Tempo medio conversazione\n- Top domande frequenti"
          }
        ]
      }
    ]
  },

  templateGuide: {
    title: "Template WhatsApp",
    path: "/consultant/whatsapp-templates",
    emoji: "📝",
    description: "Gestione template Twilio per messaggi proattivi e template custom personalizzati con variabili",
    sections: [
      {
        title: "TEMPLATE TWILIO (PER MESSAGGI PROATTIVI)",
        icon: "📤",
        description: "Template approvati da Twilio per inviare il primo messaggio ai lead",
        steps: [
          {
            title: "Vai su Template WhatsApp",
            content: "COMUNICAZIONE → Template WhatsApp (URL: /consultant/whatsapp-templates)",
            actionText: "Gestisci Template Twilio",
            actionHref: "/consultant/whatsapp-templates"
          },
          {
            title: "Cosa sono i Template Twilio",
            content: "Per inviare il PRIMO messaggio a un lead su WhatsApp (messaggio proattivo), Twilio richiede l'uso di template pre-approvati. Questi template garantiscono che il contenuto rispetti le policy di WhatsApp Business."
          },
          {
            title: "Creare un nuovo template",
            content: "Clicca 'Nuovo Template' e compila:\n- Nome template: identificativo univoco\n- Categoria: Marketing, Utility, Authentication\n- Lingua: it, en, ecc.\n- Corpo del messaggio: testo con variabili {{1}}, {{2}}, ecc."
          },
          {
            title: "Stati del template",
            content: "🟡 Pending: Inviato a Twilio, in attesa di approvazione\n🟢 Approved: Approvato e pronto per l'uso\n🔴 Rejected: Rifiutato - modifica e reinvia"
          },
          {
            title: "Tempo di approvazione",
            content: "L'approvazione da parte di WhatsApp/Twilio può richiedere da pochi minuti a 24-48 ore. I template di tipo 'Utility' sono generalmente approvati più velocemente."
          },
          {
            title: "Best Practices",
            content: "✅ Usa un linguaggio chiaro e non spam\n✅ Evita promesse irrealistiche\n✅ Includi un modo per l'utente di cancellarsi\n✅ Non usare tutto maiuscolo\n❌ Evita contenuti promozionali aggressivi"
          }
        ]
      },
      {
        title: "TEMPLATE CUSTOM (PERSONALIZZATI)",
        icon: "✏️",
        description: "Template interni con variabili dinamiche per follow-up e risposte",
        steps: [
          {
            title: "Vai su Template Custom",
            content: "COMUNICAZIONE → WhatsApp - Template Custom (URL: /consultant/whatsapp/custom-templates/list)",
            actionText: "Gestisci Template Custom",
            actionHref: "/consultant/whatsapp/custom-templates/list"
          },
          {
            title: "Differenza con Template Twilio",
            content: "I Template Custom sono per uso INTERNO nell'app:\n- Non richiedono approvazione Twilio\n- Usati per follow-up (dopo che il lead ha risposto)\n- Contengono variabili dinamiche come {nome_lead}, {uncino}, ecc."
          },
          {
            title: "Creare template custom",
            content: "Clicca 'Nuovo Template' e configura:\n- Nome: identificativo del template\n- Tipo: apertura, follow-up gentile, follow-up valore, finale\n- Corpo: messaggio con variabili"
          },
          {
            title: "Variabili disponibili",
            content: "Usa queste variabili nel testo:\n- {nome_lead} = Nome del contatto\n- {cognome_lead} = Cognome\n- {uncino} = Uncino della campagna\n- {obiettivi} = Obiettivi stato ideale\n- {desideri} = Desideri impliciti\n- {nome_consulente} = Il tuo nome"
          },
          {
            title: "Preview template",
            content: "Usa il bottone 'Preview' per vedere come apparirà il messaggio con dati di esempio prima di salvare."
          }
        ]
      },
      {
        title: "ASSEGNAZIONE TEMPLATE AGLI AGENTI",
        icon: "🤖",
        description: "Come collegare template agli agenti WhatsApp",
        steps: [
          {
            title: "Template di default agente",
            content: "Ogni agente WhatsApp può avere template predefiniti che usa automaticamente per i messaggi di apertura e follow-up."
          },
          {
            title: "Assegnare template a campagna",
            content: "Quando crei una campagna marketing, puoi selezionare quali template usare. La campagna sovrascrive i template di default dell'agente."
          },
          {
            title: "Priorità template",
            content: "Ordine di priorità:\n1. Template specifico della campagna (se configurato)\n2. Template di default dell'agente\n3. Template generico del sistema"
          },
          {
            title: "Verifica template attivo",
            content: "Nel dettaglio della campagna o dell'agente, puoi vedere quale template è attualmente in uso per ogni tipo di messaggio."
          }
        ]
      }
    ]
  },

  proactiveLeadsGuide: {
    title: "CRM Lead Proattivi",
    path: "/consultant/proactive-leads",
    emoji: "👥",
    description: "Gestione completa dei lead per contatto proattivo: importazione, stati, tag e schedulazione",
    sections: [
      {
        title: "IMPORTARE LEAD DA CSV",
        icon: "📥",
        description: "Come caricare una lista di lead da file",
        steps: [
          {
            title: "Vai su Lead Proattivi",
            content: "COMUNICAZIONE → Lead (URL: /consultant/proactive-leads)",
            actionText: "Gestisci Lead",
            actionHref: "/consultant/proactive-leads"
          },
          {
            title: "Clicca 'Importa CSV'",
            content: "In alto trovi il bottone 'Importa' o 'Importa CSV'. Clicca per aprire il dialogo di importazione."
          },
          {
            title: "Formato CSV richiesto",
            content: "Il file CSV deve avere queste colonne:\n- Nome (obbligatorio)\n- Cognome (opzionale)\n- Telefono (obbligatorio, formato: +39...)\n- Email (opzionale)\n- Note (opzionale)"
          },
          {
            title: "Seleziona campagna",
            content: "Durante l'import puoi assegnare tutti i lead a una campagna. I lead erediteranno automaticamente uncino, obiettivi e template della campagna."
          },
          {
            title: "Verifica e conferma",
            content: "Il sistema mostra un'anteprima dei lead che verranno importati. Verifica i dati e clicca 'Importa' per confermare."
          },
          {
            title: "Duplicati",
            content: "Il sistema rileva automaticamente lead duplicati (stesso numero di telefono) e ti chiede se sovrascriverli o saltarli."
          }
        ]
      },
      {
        title: "AGGIUNGERE LEAD MANUALMENTE",
        icon: "➕",
        description: "Come inserire singoli lead uno alla volta",
        steps: [
          {
            title: "Clicca 'Nuovo Lead'",
            content: "Nella pagina Lead Proattivi, clicca il bottone 'Nuovo Lead' o '+' in alto a destra."
          },
          {
            title: "Compila i campi",
            content: "Inserisci:\n- Nome e Cognome\n- Numero telefono (formato internazionale)\n- Email (opzionale)\n- Campagna di appartenenza\n- Note aggiuntive"
          },
          {
            title: "Programma contatto",
            content: "Puoi impostare quando contattare il lead:\n- Subito: primo messaggio inviato immediatamente\n- Data/ora specifica: schedulato per il futuro\n- In attesa: manuale, quando vuoi tu"
          },
          {
            title: "Salva lead",
            content: "Clicca 'Salva'. Il lead appare nella lista con stato 'Pending' pronto per essere contattato."
          }
        ]
      },
      {
        title: "GESTIONE STATI LEAD",
        icon: "🔄",
        description: "Capire e gestire i diversi stati dei lead",
        steps: [
          {
            title: "Stati disponibili",
            content: "🟡 Pending: Lead importato, non ancora contattato\n🔵 Contacted: Primo messaggio inviato, attesa risposta\n🟢 Responded: Il lead ha risposto\n✅ Converted: Lead diventato cliente\n❌ Disqualified: Lead non in target"
          },
          {
            title: "Transizioni automatiche",
            content: "Il sistema aggiorna automaticamente lo stato:\n- Pending → Contacted: quando invii il primo messaggio\n- Contacted → Responded: quando il lead risponde\n- Gli stati Converted e Disqualified sono manuali"
          },
          {
            title: "Cambiare stato manualmente",
            content: "Clicca sul lead, poi sul menu a tendina 'Stato' per cambiarlo manualmente. Utile per segnare conversioni offline o disqualificare lead."
          },
          {
            title: "Filtri per stato",
            content: "Usa i filtri in alto per vedere solo lead di un certo stato. Utile per concentrarti sui lead che hanno risposto."
          }
        ]
      },
      {
        title: "TAG E FILTRI",
        icon: "🏷️",
        description: "Organizzare i lead con tag e filtri avanzati",
        steps: [
          {
            title: "Aggiungere tag",
            content: "Ogni lead può avere tag personalizzati. Clicca sul lead → 'Aggiungi Tag' e crea o seleziona tag esistenti (es: 'Facebook Ads', 'Hot Lead', 'Richiamato')."
          },
          {
            title: "Filtro per tag",
            content: "Usa il filtro 'Tag' per vedere solo lead con tag specifici. Puoi combinare più tag per ricerche avanzate."
          },
          {
            title: "Filtro per campagna",
            content: "Seleziona una campagna per vedere solo i lead associati. Utile per analizzare le performance per fonte."
          },
          {
            title: "Ricerca testuale",
            content: "La barra di ricerca cerca in nome, cognome, telefono e note. Trova rapidamente qualsiasi lead."
          }
        ]
      },
      {
        title: "SCHEDULAZIONE CONTATTO",
        icon: "📅",
        description: "Programmare quando contattare i lead",
        steps: [
          {
            title: "Contatto immediato",
            content: "Per lead 'caldi' (appena arrivati da form), imposta contatto immediato. Il primo messaggio parte subito."
          },
          {
            title: "Contatto programmato",
            content: "Per lead 'freddi' o liste importate, schedula il contatto per data/ora specifica. Es: domani alle 10:00."
          },
          {
            title: "Distribuzione temporale",
            content: "Quando importi molti lead, il sistema può distribuirli nel tempo per evitare di inviare troppi messaggi insieme (es: 10 lead ogni ora)."
          },
          {
            title: "Rispetto orari",
            content: "Il sistema rispetta gli orari di lavoro dell'agente. Se programmi un contatto alle 23:00 ma l'agente lavora 9-18, il messaggio partirà alle 9:00 del giorno dopo."
          },
          {
            title: "Follow-up automatici",
            content: "Dopo il primo contatto, il sistema può inviare follow-up automatici a intervalli configurati (es: dopo 24h, dopo 3 giorni, dopo 1 settimana)."
          }
        ]
      }
    ]
  },

  whatsappAgentsGuide: {
    title: "Setup Agenti WhatsApp",
    path: "/consultant/whatsapp",
    emoji: "🤖",
    description: "Guida completa per creare e configurare agenti AI WhatsApp con wizard 4 step",
    sections: [
      {
        title: "CREAZIONE NUOVO AGENTE (WIZARD)",
        icon: "✨",
        description: "Come creare un nuovo agente passo passo",
        steps: [
          {
            title: "Vai su Setup Agenti",
            content: "COMUNICAZIONE → Setup Agenti (URL: /consultant/whatsapp)",
            actionText: "Configura Agenti",
            actionHref: "/consultant/whatsapp"
          },
          {
            title: "Clicca 'Nuovo Agente'",
            content: "In alto a destra trovi il bottone 'Nuovo Agente' o '+'. Clicca per avviare il wizard guidato in 4 step."
          },
          {
            title: "Step 1: Configurazione Base",
            content: "Inserisci:\n- Nome agente (es: 'Receptionist Marco')\n- Tipo agente (Reattivo, Proattivo, Educativo)\n- Modalità integrazione (WhatsApp+AI o Solo AI)\n- Credenziali Twilio (se WhatsApp+AI)"
          },
          {
            title: "Step 2: Disponibilità",
            content: "Configura:\n- Orari di lavoro (es: Lun-Ven 9-18)\n- Messaggio fuori orario\n- Funzionalità abilitate (prenotazione, obiezioni, upselling)"
          },
          {
            title: "Step 3: Brand Voice",
            content: "Definisci:\n- Nome business e descrizione\n- Bio consulente\n- Mission, Vision, Valori\n- USP (Unique Selling Proposition)\n- Target e anti-target"
          },
          {
            title: "Step 4: Istruzioni AI",
            content: "Configura:\n- Template istruzioni (Receptionist, Setter, Educativo)\n- Personalità AI (Amico fidato, Consulente esperto, Coach)\n- Istruzioni custom aggiuntive"
          }
        ]
      },
      {
        title: "TIPI DI AGENTE",
        icon: "📋",
        description: "Quando usare quale tipo di agente",
        steps: [
          {
            title: "📱 Agente REATTIVO (Receptionist)",
            content: "USO: Per rispondere a chi ti contatta spontaneamente\n\nCOMPORTAMENTO:\n- Aspetta messaggi in arrivo\n- Risponde automaticamente\n- Qualifica il lead con domande\n- Prenota appuntamenti nel calendario\n\nIDEALE PER: Landing page, QR code, campagne dove il lead inizia la conversazione"
          },
          {
            title: "🚀 Agente PROATTIVO (Setter)",
            content: "USO: Per contattare lead che hai importato\n\nCOMPORTAMENTO:\n- Invia primo messaggio programmato\n- Fa follow-up automatici\n- Usa template personalizzati\n- Persiste fino a risposta o disqualificazione\n\nIDEALE PER: Lead da form, Facebook Ads, liste importate"
          },
          {
            title: "📚 Agente EDUCATIVO (Advisor)",
            content: "USO: Per fornire informazioni senza vendere\n\nCOMPORTAMENTO:\n- Risponde a domande informative\n- Fornisce contenuti formativi\n- NON prenota appuntamenti\n- NON fa vendita aggressiva\n\nIDEALE PER: Supporto clienti esistenti, FAQ automatiche, contenuti educativi"
          }
        ]
      },
      {
        title: "MODALITÀ INTEGRAZIONE",
        icon: "🔌",
        description: "WhatsApp+AI vs Solo AI",
        steps: [
          {
            title: "🟢 WhatsApp + AI (Richiede Twilio)",
            content: "Funzionalità:\n- Riceve messaggi WhatsApp reali\n- Invia risposte automatiche\n- Collegato a numero WhatsApp Business\n- Per comunicazione con clienti reali\n\nRequisiti:\n- Account Twilio attivo\n- Numero WhatsApp Business\n- Credenziali API configurate"
          },
          {
            title: "🟣 Solo AI (Senza Twilio)",
            content: "Funzionalità:\n- Chat interna solo nell'app\n- Per test e simulazioni\n- Per usare AI senza WhatsApp\n- Nessuna credenziale richiesta\n\nUSI:\n- Testare l'agente prima del lancio\n- Chat widget su sito web\n- Demo per clienti"
          }
        ]
      },
      {
        title: "CONFIGURAZIONE TWILIO",
        icon: "⚙️",
        description: "Come ottenere e inserire le credenziali Twilio",
        steps: [
          {
            title: "Creare account Twilio",
            content: "1. Vai su twilio.com e registrati\n2. Completa la verifica email e telefono\n3. Accedi alla dashboard Twilio"
          },
          {
            title: "Ottenere Account SID",
            content: "Dashboard → Account Info → Account SID\nInizia con 'AC...' ed è lungo circa 34 caratteri. Copialo e incollalo nel campo 'Account SID'."
          },
          {
            title: "Ottenere Auth Token",
            content: "Dashboard → Account Info → Auth Token\nClicca 'Show' per vedere il token. È una stringa lunga segreta. Copialo e incollalo nel campo 'Auth Token'."
          },
          {
            title: "Ottenere numero WhatsApp",
            content: "Phone Numbers → Buy a Number → Seleziona 'WhatsApp Enabled'\nOppure usa il Sandbox WhatsApp per test gratuiti.\nFormato: +39xxxxxxxxxx"
          },
          {
            title: "Configurare Webhook",
            content: "Il sistema genera automaticamente un URL webhook. Copia l'URL e incollalo in:\nTwilio → Messaging → Settings → WhatsApp Sandbox → When a message comes in"
          }
        ]
      },
      {
        title: "BRAND VOICE E ISTRUZIONI AI",
        icon: "🎭",
        description: "Personalizzare la voce e il comportamento dell'agente",
        steps: [
          {
            title: "Informazioni Business",
            content: "Compila tutti i campi del Brand Voice:\n- Nome business: Come ti chiami\n- Descrizione: Cosa fai in 1-2 frasi\n- Bio consulente: Chi sei e la tua esperienza"
          },
          {
            title: "Mission e Valori",
            content: "Definisci:\n- Mission: Perché esisti\n- Vision: Dove vuoi arrivare\n- Valori: Cosa ti guida\n- USP: Cosa ti rende unico"
          },
          {
            title: "Target e Anti-Target",
            content: "Specifica:\n- Chi aiuti: Il tuo cliente ideale\n- Chi NON aiuti: Chi non è in target\nL'AI userà queste info per qualificare i lead."
          },
          {
            title: "Personalità AI",
            content: "Scegli tra:\n- Amico fidato: Empatico, supportivo, usa 'tu'\n- Consulente esperto: Professionale, autorevole, usa 'Lei'\n- Coach motivazionale: Energico, positivo, ispiratore"
          },
          {
            title: "Istruzioni Custom",
            content: "Aggiungi istruzioni specifiche:\n- Frasi da usare sempre\n- Argomenti da evitare\n- Risposte a FAQ comuni\n- Tono specifico per situazioni"
          }
        ]
      }
    ]
  },

  apiKeysGuide: {
    title: "Configurazione API Keys",
    path: "/consultant/api-keys-unified",
    emoji: "🔑",
    description: "Guida completa per configurare tutte le API: Vertex AI, SMTP, Google Calendar, TURN/Metered",
    sections: [
      {
        title: "VERTEX AI / GEMINI",
        icon: "🧠",
        description: "Configurare l'intelligenza artificiale",
        steps: [
          {
            title: "Vai su API Keys",
            content: "IMPOSTAZIONI → API Keys (URL: /consultant/api-keys-unified)",
            actionText: "Configura API",
            actionHref: "/consultant/api-keys-unified"
          },
          {
            title: "Seleziona tab AI",
            content: "Nella pagina API Keys, seleziona la tab 'AI / Gemini' per configurare il provider AI."
          },
          {
            title: "Scegli provider",
            content: "Due opzioni:\n🟢 Vertex AI (Google Cloud): Più potente, richiede progetto GCP\n🟡 Google AI Studio: Più semplice, API key diretta"
          },
          {
            title: "Configurare Vertex AI",
            content: "Se scegli Vertex AI:\n1. Crea progetto su Google Cloud Console\n2. Abilita Vertex AI API\n3. Crea Service Account con ruolo 'Vertex AI User'\n4. Scarica JSON delle credenziali\n5. Copia il contenuto nel campo 'Credenziali JSON'"
          },
          {
            title: "Configurare Google AI Studio",
            content: "Se scegli Google AI Studio:\n1. Vai su aistudio.google.com\n2. Crea API Key\n3. Copia la chiave nel campo 'API Key'"
          },
          {
            title: "Test connessione",
            content: "Clicca 'Test Connessione' per verificare che le credenziali funzionino. Vedrai un messaggio di conferma se tutto è OK."
          }
        ]
      },
      {
        title: "SMTP PER EMAIL",
        icon: "📧",
        description: "Configurare l'invio email automatiche",
        steps: [
          {
            title: "Seleziona tab Email SMTP",
            content: "Nella pagina API Keys, seleziona la tab 'Email SMTP'."
          },
          {
            title: "Configurazione Gmail (consigliata)",
            content: "Per Gmail:\n1. Host: smtp.gmail.com\n2. Porta: 587\n3. Email: tua-email@gmail.com\n4. Password: genera 'App Password' da Google Account Security\n\nNOTA: Devi abilitare la verifica in 2 passaggi su Google Account."
          },
          {
            title: "Generare App Password Gmail",
            content: "1. Vai su myaccount.google.com\n2. Sicurezza → Verifica in 2 passaggi (attivala se non attiva)\n3. Sicurezza → Password per le app\n4. Crea nuova password per 'Posta'\n5. Copia la password generata (16 caratteri senza spazi)"
          },
          {
            title: "Altri provider SMTP",
            content: "Outlook: smtp-mail.outlook.com (587)\nYahoo: smtp.mail.yahoo.com (587)\nSendGrid: smtp.sendgrid.net (587)\nMailgun: smtp.mailgun.org (587)"
          },
          {
            title: "From Email e Nome",
            content: "Configura come appariranno le tue email:\n- From Email: indirizzo mittente\n- From Name: nome che vedranno i destinatari"
          },
          {
            title: "Test invio email",
            content: "Clicca 'Invia Email di Test' per verificare la configurazione. Riceverai un'email di prova all'indirizzo configurato."
          }
        ]
      },
      {
        title: "GOOGLE CALENDAR",
        icon: "📅",
        description: "Collegare il calendario per appuntamenti automatici",
        steps: [
          {
            title: "Seleziona tab Calendar",
            content: "Nella pagina API Keys, seleziona la tab 'Google Calendar'."
          },
          {
            title: "Creare credenziali OAuth",
            content: "1. Vai su Google Cloud Console\n2. APIs & Services → Credentials\n3. Create Credentials → OAuth 2.0 Client ID\n4. Application type: Web application\n5. Authorized redirect URIs: aggiungi l'URL del tuo sistema"
          },
          {
            title: "Inserire credenziali",
            content: "Copia e incolla:\n- Client ID: termina con .apps.googleusercontent.com\n- Client Secret: stringa generata\n- Redirect URI: URL di callback del sistema"
          },
          {
            title: "Autorizzare l'accesso",
            content: "Clicca 'Connetti Google Calendar'. Si aprirà una finestra Google per autorizzare l'accesso al tuo calendario."
          },
          {
            title: "Selezionare calendario",
            content: "Dopo l'autorizzazione, seleziona quale calendario usare per gli appuntamenti. Puoi usare il calendario principale o crearne uno dedicato."
          },
          {
            title: "Test prenotazione",
            content: "Crea un appuntamento di test per verificare che venga sincronizzato correttamente con Google Calendar."
          }
        ]
      },
      {
        title: "TURN/METERED PER VIDEO MEETING",
        icon: "🎥",
        description: "Configurare server TURN per video chiamate stabili",
        steps: [
          {
            title: "Cos'è un server TURN",
            content: "I server TURN aiutano a stabilire connessioni video quando i partecipanti sono dietro firewall o NAT restrittivi. Senza TURN, alcune chiamate potrebbero non connettersi."
          },
          {
            title: "Seleziona tab Video/TURN",
            content: "Nella pagina API Keys, seleziona la tab 'Video Meeting' o 'TURN Server'."
          },
          {
            title: "Provider consigliato: Metered",
            content: "Metered.ca offre server TURN affidabili:\n1. Registrati su metered.ca\n2. Crea un'applicazione\n3. Copia le credenziali TURN"
          },
          {
            title: "Inserire credenziali TURN",
            content: "Configura:\n- TURN URL: turn:xxx.metered.ca:443\n- Username: fornito da Metered\n- Credential: password fornita da Metered"
          },
          {
            title: "Test connessione TURN",
            content: "Clicca 'Test TURN' per verificare che il server sia raggiungibile. Il test verifica la connettività UDP e TCP."
          },
          {
            title: "Quando è necessario",
            content: "Il server TURN è opzionale ma consigliato se:\n- I tuoi clienti usano reti aziendali restrittive\n- Hai problemi di connessione nelle video chiamate\n- Vuoi massimizzare l'affidabilità"
          }
        ]
      },
      {
        title: "VERIFICA STATO CONNESSIONI",
        icon: "✅",
        description: "Come verificare che tutto funzioni",
        steps: [
          {
            title: "Badge stato AI",
            content: "In alto nella pagina vedi un badge:\n🟢 Verde = Vertex AI attivo\n🟡 Giallo = Google AI Studio fallback\n🔴 Rosso = Nessun AI configurato"
          },
          {
            title: "Stato per sezione",
            content: "Ogni tab mostra lo stato della configurazione:\n✅ Configurato e funzionante\n⚠️ Configurato ma con problemi\n❌ Non configurato"
          },
          {
            title: "Test completo",
            content: "Usa i bottoni 'Test' in ogni sezione per verificare che le credenziali funzionino correttamente prima di salvare."
          },
          {
            title: "Troubleshooting",
            content: "Se un test fallisce:\n1. Verifica che le credenziali siano corrette (no spazi extra)\n2. Controlla che l'API/servizio sia abilitato\n3. Verifica i permessi dell'account\n4. Controlla eventuali limiti di quota"
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
