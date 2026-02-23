import { consultantGuides } from "../consultant-guides";

export type OnboardingStepId = 
  // Priority 1 - Critical
  | 'twilio'
  | 'smtp'
  | 'vertex_ai'
  | 'lead_import'
  // Priority 2 - High
  | 'whatsapp_template'
  | 'agent_inbound'
  | 'first_campaign'
  | 'agent_outbound'
  | 'stripe_connect'
  | 'knowledge_base'
  | 'google_calendar'
  | 'google_calendar_agents'
  | 'voice_calls'
  // Priority 3 - Medium
  | 'agent_consultative'
  | 'email_journey'
  | 'nurturing_emails'
  // Priority 4 - Normal
  | 'ai_autonomo'
  | 'summary_email'
  | 'email_hub'
  | 'agent_public_link'
  | 'instagram'
  // Priority 5 - Optional
  | 'turn_config'
  | 'agent_ideas'
  | 'more_templates'
  | 'first_course'
  | 'first_exercise'
  | 'whatsapp_ai';

export type OnboardingStepStatus = 'pending' | 'configured' | 'verified' | 'error' | 'skipped';

export interface OnboardingStepInfo {
  id: OnboardingStepId;
  priority: 1 | 2 | 3 | 4 | 5;
  section: string;
  title: string;
  content: string;
  isRequired: boolean;
  actionHref?: string;
  tips?: string[];
  warnings?: string[];
}

export const onboardingSteps: OnboardingStepInfo[] = [
  // ─── PRIORITY 1 — CRITICA ────────────────────────────────────────────────
  {
    id: 'twilio',
    priority: 1,
    section: 'Acquisisci Clienti',
    title: 'Configurazione Twilio + WhatsApp',
    content: "Collega il tuo numero WhatsApp Business tramite Twilio. Senza questo, nessun agente AI può inviare o ricevere messaggi WhatsApp.",
    isRequired: true,
    actionHref: '/consultant/api-keys-unified?tab=twilio',
    tips: [
      'Crea account su twilio.com e richiedi WhatsApp Business API',
      'Inserisci Account SID, Auth Token e numero WhatsApp',
      "L'approvazione Meta può richiedere 1-3 giorni lavorativi"
    ],
    warnings: ['Senza Twilio nessun agente WhatsApp può funzionare']
  },
  {
    id: 'smtp',
    priority: 1,
    section: 'Integrazioni & Sistema',
    title: 'Email SMTP',
    content: "Configura il server SMTP per inviare email automatiche ai clienti, email di follow-up dopo le consulenze, e il journey email automatico.",
    isRequired: true,
    actionHref: '/consultant/api-keys-unified?tab=email',
    tips: [
      'Gmail: smtp.gmail.com porta 587, abilita App Password',
      'Outlook: smtp.office365.com porta 587',
      'Qualsiasi provider SMTP personalizzato funziona'
    ],
    warnings: ['Senza SMTP non puoi inviare email ai clienti']
  },
  {
    id: 'vertex_ai',
    priority: 1,
    section: 'Integrazioni & Sistema',
    title: 'AI Engine (Gemini)',
    content: "L'AI è già attiva sul tuo account tramite Google AI Studio pre-configurato dal SuperAdmin. Puoi aggiungere una tua chiave Gemini personale per avere un account AI dedicato con limiti separati.",
    isRequired: false,
    actionHref: '/consultant/api-keys-unified?tab=ai',
    tips: [
      "L'AI funziona già senza configurazione aggiuntiva",
      'Aggiungi chiave personale solo se vuoi un limite di utilizzo dedicato',
      'Ottieni la chiave su aistudio.google.com → Crea chiave API'
    ],
  },
  {
    id: 'lead_import',
    priority: 1,
    section: 'Acquisisci Clienti',
    title: 'Import Lead Automatico',
    content: "Configura il webhook per ricevere lead automaticamente da strumenti di marketing come Zapier, Make.com, n8n, Facebook Ads e Google Ads.",
    isRequired: true,
    actionHref: '/consultant/api-keys-unified?tab=lead-import',
    tips: [
      'Il tuo webhook URL personale è nella pagina di configurazione',
      'Compatibile con Zapier, Make.com, n8n e qualsiasi piattaforma con HTTP webhook',
      'I lead ricevuti entrano automaticamente nella pipeline e vengono contattati dagli agenti'
    ],
  },

  // ─── PRIORITY 2 — ALTA ───────────────────────────────────────────────────
  {
    id: 'whatsapp_template',
    priority: 2,
    section: 'Acquisisci Clienti',
    title: 'Template WhatsApp Approvato',
    content: "Crea e fai approvare da Twilio almeno un template WhatsApp. I template sono obbligatori per inviare il primo messaggio proattivo ai lead — senza di essi non puoi avviare conversazioni.",
    isRequired: false,
    actionHref: '/consultant/whatsapp-templates',
    tips: [
      "Crea template con categoria 'Primo Contatto' o 'Setter'",
      "Usa variabili come {{1}} per personalizzare il nome del lead",
      "L'approvazione Twilio richiede da pochi minuti a 24 ore"
    ],
    warnings: ['Senza template approvato non puoi inviare messaggi proattivi ai lead']
  },
  {
    id: 'agent_inbound',
    priority: 2,
    section: 'Acquisisci Clienti',
    title: 'Agente Inbound',
    content: "L'agente Inbound risponde automaticamente 24/7 ai lead che ti contattano su WhatsApp. Gestisce domande frequenti, qualifica i lead e può prenotare appuntamenti nel calendario.",
    isRequired: false,
    actionHref: '/consultant/whatsapp',
    tips: [
      'Ideale per gestire i lead in entrata senza intervento manuale',
      'Personalizza il nome, la personalità e il tono dell\'agente',
      'Collegalo al tuo Google Calendar per prenotazioni automatiche'
    ],
    warnings: ['Richiede Twilio configurato']
  },
  {
    id: 'first_campaign',
    priority: 2,
    section: 'Acquisisci Clienti',
    title: 'Prima Campagna Marketing',
    content: "Configura la tua prima campagna marketing collegando fonti lead → template WhatsApp → agente AI. Ogni lead importato dal webhook verrà contattato automaticamente con il template scelto.",
    isRequired: false,
    actionHref: '/consultant/campaigns',
    tips: [
      'Scegli un nome descrittivo per la campagna',
      'Seleziona il template approvato da usare per il primo messaggio',
      'Assegna l\'agente outbound che gestirà le conversazioni'
    ],
    warnings: ['Richiede almeno un template WhatsApp approvato e un agente configurato']
  },
  {
    id: 'agent_outbound',
    priority: 2,
    section: 'Chiudi e Incassa',
    title: 'Agente Outbound',
    content: "L'agente Outbound contatta proattivamente i lead delle campagne. Segue script personalizzati per qualificare i lead e convertirli in appuntamenti o vendite.",
    isRequired: false,
    actionHref: '/consultant/whatsapp',
    tips: [
      'Usalo insieme alle campagne marketing',
      "Definisci 'uncini' efficaci per catturare l'attenzione del lead",
      "L'agente usa il template approvato per il primo contatto"
    ],
  },
  {
    id: 'stripe_connect',
    priority: 2,
    section: 'Chiudi e Incassa',
    title: 'Stripe — Pagamenti',
    content: "Collega il tuo account Stripe per ricevere pagamenti dagli abbonamenti dei clienti direttamente sulla piattaforma, con revenue sharing automatico.",
    isRequired: false,
    actionHref: '/consultant/whatsapp?tab=licenses',
    tips: [
      'Completa l\'onboarding Stripe per ricevere pagamenti',
      'Gestisci le licenze dei tuoi clienti dalla sezione Licenze',
      'Traccia i guadagni dalla dashboard'
    ],
  },
  {
    id: 'knowledge_base',
    priority: 2,
    section: 'Contenuti & Autorità',
    title: 'Base di Conoscenza',
    content: "Carica documenti, PDF, e contenuti che l'AI userà per rispondere alle domande dei clienti. Più materiale carichi, più accurate saranno le risposte degli agenti.",
    isRequired: false,
    actionHref: '/consultant/knowledge-documents',
    tips: [
      'Carica PDF, documenti Word, presentazioni, testo libero',
      "L'AI indicizza automaticamente e usa i contenuti per rispondere",
      "Usato sia dall'AI Assistant che dagli agenti WhatsApp"
    ],
  },
  {
    id: 'google_calendar',
    priority: 2,
    section: 'Integrazioni & Sistema',
    title: 'Google Calendar Consulente',
    content: "Collega il tuo Google Calendar personale per sincronizzare automaticamente gli appuntamenti con i clienti — prenotazioni, consulenze e follow-up.",
    isRequired: false,
    actionHref: '/consultant/appointments',
    tips: [
      'Clicca "Connetti Google Calendar" nella pagina appuntamenti',
      'Autorizza il tuo account Google personale',
      'Gli appuntamenti si sincronizzano automaticamente in entrambe le direzioni'
    ],
  },
  {
    id: 'google_calendar_agents',
    priority: 2,
    section: 'Integrazioni & Sistema',
    title: 'Google Calendar Agenti WhatsApp',
    content: "Collega Google Calendar a ciascun agente WhatsApp per la prenotazione automatica degli appuntamenti durante le conversazioni. Ogni agente può usare un account Google diverso.",
    isRequired: false,
    actionHref: '/consultant/whatsapp',
    tips: [
      'Vai su Agenti WhatsApp → seleziona un agente → sezione Google Calendar',
      'Ogni agente può avere il proprio account Google per calendari separati',
      'Permette ai lead di prenotare appuntamenti direttamente via WhatsApp'
    ],
  },
  {
    id: 'voice_calls',
    priority: 2,
    section: 'AI Operativa',
    title: 'Chiamate Voice (Alessia AI)',
    content: "Completa almeno una chiamata vocale con il sistema Alessia AI Phone. La voce AI chiama i lead e conduce conversazioni di qualificazione o vendita in autonomia.",
    isRequired: false,
    actionHref: '/consultant/ai-phone',
    tips: [
      'Configura prima il sistema Voice nelle impostazioni',
      'Alessia chiama i lead e gestisce la conversazione con AI',
      "Richiede un numero telefonico Twilio con capacità voice"
    ],
  },

  // ─── PRIORITY 3 — MEDIA ──────────────────────────────────────────────────
  {
    id: 'agent_consultative',
    priority: 3,
    section: 'Chiudi e Incassa',
    title: 'Agente Consulenziale',
    content: "L'agente Consulenziale assiste durante le sessioni con i clienti e risponde a domande tecniche usando la Knowledge Base. Utile per il supporto post-consulenza.",
    isRequired: false,
    actionHref: '/consultant/whatsapp',
    tips: [
      'Collegalo alla Knowledge Base per risposte accurate e personalizzate',
      'Utile per supporto post-consulenza e domande frequenti dei clienti attivi',
      'Può rispondere in autonomia senza intervenire manualmente'
    ],
  },
  {
    id: 'email_journey',
    priority: 3,
    section: 'AI Operativa',
    title: 'Email Journey',
    content: "Configura l'automazione email per i tuoi clienti. Scegli tra modalità bozza (approvazione manuale prima dell'invio) o invio automatico. Personalizza i 31 template con l'AI.",
    isRequired: false,
    actionHref: '/consultant/ai-config?tab=ai-email',
    tips: [
      "Attiva 'Automation Generale' per abilitare l'invio automatico",
      'Imposta la frequenza in giorni tra un\'email e l\'altra',
      "Modifica i 31 template con l'AI per adattarli al tuo brand"
    ],
    warnings: ['Richiede SMTP configurato']
  },
  {
    id: 'nurturing_emails',
    priority: 3,
    section: 'AI Operativa',
    title: 'Email Nurturing 365',
    content: "Genera 365 email automatiche per nutrire i tuoi lead nel tempo. L'AI crea contenuti personalizzati basati sul tuo brand, settore e stile comunicativo.",
    isRequired: false,
    actionHref: '/consultant/ai-config?tab=lead-nurturing',
    tips: [
      'Genera tutte le 365 email con un singolo click',
      'Personalizza topic, tono e stile del brand prima della generazione',
      'Le email partono automaticamente ogni giorno ai lead nella pipeline'
    ],
    warnings: ['Richiede SMTP configurato']
  },

  // ─── PRIORITY 4 — NORMALE ────────────────────────────────────────────────
  {
    id: 'ai_autonomo',
    priority: 4,
    section: 'AI Operativa',
    title: 'AI Autonomo',
    content: "Attiva il sistema AI Autonomo e completa almeno un task automatico generato dall'AI. Il sistema analizza i tuoi clienti e genera task di follow-up, analisi e azioni proattive.",
    isRequired: false,
    actionHref: '/consultant/ai-autonomy',
    tips: [
      "L'AI genera task automatici basati sul contesto dei tuoi clienti",
      'Puoi eseguire i task manualmente o lasciarli all\'AI',
      'Inizia con task semplici come analisi lead o promemoria follow-up'
    ],
  },
  {
    id: 'summary_email',
    priority: 4,
    section: 'Chiudi e Incassa',
    title: 'Prima Email Riassuntiva',
    content: "Dopo una consulenza, genera automaticamente un'email di riepilogo con i punti chiave discussi, le decisioni prese e i prossimi passi. Inviala al cliente in pochi secondi.",
    isRequired: false,
    actionHref: '/consultant/appointments',
    tips: [
      "L'AI genera la bozza basandosi sulle note e la trascrizione della consulenza",
      'Puoi modificare la bozza prima di inviarla',
      'Completa una consulenza e usa il pulsante "Genera Email Riassuntiva"'
    ],
  },
  {
    id: 'email_hub',
    priority: 4,
    section: 'AI Operativa',
    title: 'Email Hub',
    content: "Collega il tuo account email (IMAP/SMTP) per gestire inbox, invii automatici e risposte AI in un hub centralizzato. L'AI può rispondere alle email usando la Knowledge Base.",
    isRequired: false,
    actionHref: '/consultant/email-hub',
    tips: [
      'Supporta IMAP per ricevere e sincronizzare le email in entrata',
      "L'AI può rispondere automaticamente usando la Knowledge Base",
      'Sincronizzazione automatica in background'
    ],
  },
  {
    id: 'agent_public_link',
    priority: 4,
    section: 'Acquisisci Clienti',
    title: 'Link Pubblico Agente',
    content: "Genera un link pubblico per i tuoi agenti WhatsApp che i potenziali clienti possono usare per iniziare una conversazione con il bot. Condividilo su social, sito web e biglietti da visita.",
    isRequired: false,
    actionHref: '/consultant/whatsapp-agents-chat',
    tips: [
      'Il link avvia automaticamente una chat WhatsApp con il tuo agente',
      'Il lead viene automaticamente aggiunto alla pipeline quando scrive',
      'Puoi creare link separati per diversi agenti o campagne'
    ],
  },
  {
    id: 'instagram',
    priority: 4,
    section: 'Acquisisci Clienti',
    title: 'Instagram Direct Messaging',
    content: "Collega il tuo account Instagram Business per ricevere e rispondere ai messaggi diretti con l'AI. Richiede una pagina Facebook collegata a un account Instagram Business.",
    isRequired: false,
    actionHref: '/consultant/api-keys-unified?tab=instagram',
    tips: [
      'Richiede account Instagram Business collegato a pagina Facebook',
      "L'AI risponde automaticamente ai DM con il tuo tono e stile",
      'Configura tramite Meta Business Suite'
    ],
  },

  // ─── PRIORITY 5 — OPZIONALE ──────────────────────────────────────────────
  {
    id: 'turn_config',
    priority: 5,
    section: 'Chiudi e Incassa',
    title: 'Video Meeting (TURN)',
    content: "Configura Metered.ca per videochiamate WebRTC affidabili con i tuoi clienti. I link Meet vengono generati automaticamente per le consulenze programmate.",
    isRequired: false,
    actionHref: '/consultant/api-keys-unified?tab=video-meeting',
    tips: [
      'Crea account su metered.ca e inserisci username e API key',
      'I link Meet vengono generati automaticamente per ogni consulenza',
      'Integrazione con Fathom per trascrizioni automatiche delle videochiamate'
    ],
  },
  {
    id: 'agent_ideas',
    priority: 5,
    section: 'Contenuti & Autorità',
    title: 'Idee AI Generate',
    content: "Genera idee creative per i tuoi agenti WhatsApp usando l'intelligenza artificiale. Descrivi il tuo settore e target, e l'AI suggerirà script, messaggi e strategie.",
    isRequired: false,
    actionHref: '/consultant/whatsapp?tab=ideas',
    tips: [
      "Descrivi il tuo target e l'AI suggerirà contenuti specifici",
      'Puoi modificare e personalizzare ogni suggerimento prima di usarlo',
      'Utile per creare varianti di messaggi per test A/B'
    ],
  },
  {
    id: 'more_templates',
    priority: 5,
    section: 'Contenuti & Autorità',
    title: 'Altri Template WhatsApp',
    content: "Crea template aggiuntivi per follow-up, promemoria appuntamenti, e altre comunicazioni automatiche. Ogni template deve essere approvato da Twilio prima di poter essere usato.",
    isRequired: false,
    actionHref: '/consultant/whatsapp-templates',
    tips: [
      'Usa categorie diverse: Follow-up, Appuntamenti, Generale',
      'Crea template per ogni fase del customer journey',
      "L'approvazione Twilio richiede da pochi minuti a 24 ore"
    ],
  },
  {
    id: 'first_course',
    priority: 5,
    section: 'Contenuti & Autorità',
    title: 'Primo Corso',
    content: "Crea il tuo primo corso formativo per i clienti. Struttura il percorso in anni, trimestri, moduli e lezioni con video, testo e quiz.",
    isRequired: false,
    actionHref: '/consultant/university',
    tips: [
      'I clienti seguono i corsi dalla loro area personale',
      'Traccia i progressi e il completamento di ogni lezione',
      'Puoi assegnare corsi specifici a clienti specifici'
    ],
  },
  {
    id: 'first_exercise',
    priority: 5,
    section: 'Contenuti & Autorità',
    title: 'Primo Esercizio',
    content: "Crea esercizi pratici che i clienti devono completare e consegnare. Ricevi notifiche quando vengono consegnati per la revisione e fornisci feedback.",
    isRequired: false,
    actionHref: '/consultant/exercise-templates',
    tips: [
      'Gli esercizi aiutano i clienti ad applicare quanto appreso nelle consulenze',
      'Puoi impostare scadenze e priorità',
      'Ricevi notifiche push quando un cliente consegna un esercizio'
    ],
  },
  {
    id: 'whatsapp_ai',
    priority: 5,
    section: 'Integrazioni & Sistema',
    title: 'Chiavi AI Personali (Agenti)',
    content: "Aggiungi chiavi API Gemini personali per gli agenti WhatsApp. Permette agli agenti di usare un account AI separato con limiti dedicati, indipendente dall'account principale.",
    isRequired: false,
    actionHref: '/consultant/api-keys-unified?tab=ai',
    tips: [
      'Utile se gli agenti WhatsApp fanno molte conversazioni e vuoi separare i limiti AI',
      'Aggiungi fino a 10 chiavi — il sistema le usa in rotazione automatica',
      'Ottieni chiavi su aistudio.google.com → Crea chiave API'
    ],
  },
];

export function getOnboardingStepById(id: OnboardingStepId): OnboardingStepInfo | undefined {
  return onboardingSteps.find(step => step.id === id);
}

export function getOnboardingStepsByPriority(priority: 1 | 2 | 3 | 4 | 5): OnboardingStepInfo[] {
  return onboardingSteps.filter(step => step.priority === priority);
}

export function getRequiredSteps(): OnboardingStepInfo[] {
  return onboardingSteps.filter(step => step.isRequired);
}

export interface OnboardingStatus {
  stepId: OnboardingStepId;
  status: OnboardingStepStatus;
}

export function formatOnboardingGuideForPrompt(statuses?: OnboardingStatus[]): string {
  const statusMap = new Map(statuses?.map(s => [s.stepId, s.status]) || []);
  
  const statusEmoji: Record<OnboardingStepStatus, string> = {
    pending: '⚪',
    configured: '🟡',
    verified: '✅',
    error: '🔴',
    skipped: '⏭️'
  };

  const priorityLabels: Record<number, string> = {
    1: 'CRITICA — senza questi il sistema non funziona',
    2: 'ALTA — sblocca le funzionalità core di acquisizione e vendita',
    3: 'MEDIA — automazione email e agenti avanzati',
    4: 'NORMALE — canali aggiuntivi e features avanzate',
    5: 'OPZIONALE — contenuti, ottimizzazioni e personalizzazioni',
  };

  const lines: string[] = [
    '# MODALITÀ ONBOARDING ATTIVA',
    '',
    '## CHI SEI E COME PARLI',
    'Sei diretto, concreto, e dai del "tu". Conosci la piattaforma in ogni dettaglio — non solo come si configura, ma perché esiste ogni funzione, quando usarla, quali risultati dà. Sei umano, non robotico: ragioni insieme al consulente, capisci il suo business e lo orienti verso le scelte giuste. Niente frasi di apertura tipo "Ottima domanda" o "Certo, analizziamo insieme" — vai diretto alla risposta.',
    '',
    '## STILE DI RISPOSTA',
    'Risposte calibrate: brevi per domande tecniche (3-4 righe max), più articolate per domande strategiche ma senza dilungarti. Se usi bullet, massimo 3 — non elenchi infiniti. Parla come un esperto che conosce bene il business del consulente, non come un manuale.',
    '',
    '## I TUOI DUE RUOLI',
    '',
    '### 1. COACH DI SETUP (quando chiede "come si configura", "da dove inizio", "non riesco a fare X")',
    '- Un solo step alla volta, mai tutto insieme',
    '- Indicazioni concrete: dove cliccare, cosa inserire, link diretto',
    '- Se uno step è bloccante per altri, dillo esplicitamente',
    '- Guarda lo stato reale del setup (dati sotto) e rispondi su quello, non in astratto',
    '',
    '### 2. CONSULENTE DELLA PIATTAFORMA (quando chiede "cosa fa X", "quando uso Y", "ho questo problema")',
    '- Spiega le funzioni in modo pratico, con esempi concreti del suo settore se lo conosci',
    '- Per domande strategiche, usa il MANUALE-COMPLETO.md (indicizzato nel file search) come base',
    '- Suggerisci la combinazione di strumenti giusta per il suo obiettivo',
    '- Se ha dubbi su una funzione non configurata, spiegala e offri di aiutarlo a configurarla',
    '',
    '## IMPORTANTE: Vertex AI / AI Engine',
    "L'AI è già attiva sulla piattaforma — il SuperAdmin l'ha configurata tramite Google AI Studio. Non dire mai che 'senza Vertex AI l'AI non funziona': è falso. Aggiungere chiavi AI personali è un'opzione avanzata per chi vuole un account dedicato, non un requisito per partire.",
    '',
    '## STATO ATTUALE DEL SETUP',
    '',
  ];

  // Group steps by priority and show status
  for (let priority = 1; priority <= 5; priority++) {
    const prioritySteps = getOnboardingStepsByPriority(priority as 1 | 2 | 3 | 4 | 5);
    const completedInGroup = prioritySteps.filter(step => statusMap.get(step.id) === 'verified').length;
    
    lines.push(`### PRIORITÀ ${priority}: ${priorityLabels[priority]}`);
    lines.push(`Completati: ${completedInGroup}/${prioritySteps.length}`);
    lines.push('');
    
    for (const step of prioritySteps) {
      const status = statusMap.get(step.id) || 'pending';
      const emoji = statusEmoji[status];
      const requiredTag = step.isRequired ? ' [RICHIESTO]' : '';
      
      lines.push(`${emoji} **${step.title}**${requiredTag} — *${step.section}*`);
      lines.push(`   ${step.content}`);
      
      if (step.actionHref) {
        lines.push(`   🔗 ${step.actionHref}`);
      }
      
      if (status === 'error') {
        lines.push(`   ⚠️ ERRORE — aiuta il consulente a risolvere questo problema`);
      }
      
      lines.push('');
    }
  }

  // Dynamic "next step" suggestion
  lines.push('## PROSSIMO STEP CONSIGLIATO');
  lines.push('');
  
  // Find first pending in priority order
  let nextStep: OnboardingStepInfo | undefined;
  let nextStepStatus: OnboardingStepStatus = 'pending';
  
  for (let priority = 1; priority <= 5; priority++) {
    const prioritySteps = getOnboardingStepsByPriority(priority as 1 | 2 | 3 | 4 | 5);
    const pendingInGroup = prioritySteps.filter(step => {
      const s = statusMap.get(step.id) || 'pending';
      return s !== 'verified' && s !== 'skipped';
    });
    
    if (pendingInGroup.length > 0) {
      nextStep = pendingInGroup[0];
      nextStepStatus = statusMap.get(nextStep.id) || 'pending';
      break;
    }
  }
  
  if (nextStep) {
    const statusEmj = statusEmoji[nextStepStatus];
    lines.push(`Il prossimo step da completare è: ${statusEmj} **${nextStep.title}** (Priorità ${nextStep.priority})`);
    lines.push(`Sezione: ${nextStep.section}`);
    lines.push(`Link diretto: ${nextStep.actionHref || 'vedi impostazioni'}`);
    if (nextStep.tips && nextStep.tips.length > 0) {
      lines.push(`Suggerimento: ${nextStep.tips[0]}`);
    }
  } else {
    lines.push('🎉 Tutti gli step completati! Il sistema è completamente configurato.');
  }
  
  lines.push('');
  lines.push('## IL TUO APPROCCIO');
  lines.push('');
  lines.push('1. **Leggi lo stato reale**: Guarda cosa è ✅ fatto, cosa è ⚪ da fare, cosa ha 🔴 errore — poi rispondi su quello, non in astratto');
  lines.push('2. **Un passo alla volta**: Indica SOLO il prossimo step più importante. Non elencare tutto — lo blocchi invece di aiutarlo');
  lines.push('3. **Sii operativo**: Dove clicca, cosa inserisce, cosa deve avere pronto. Niente teoria');
  lines.push('4. **Errori = priorità**: Se uno step ha 🔴 errore, è lì che devi stare — aiutalo a capire cosa non va e come risolverlo');
  lines.push('5. **Link sempre**: Dai sempre il percorso esatto o il link diretto alla pagina di configurazione');
  lines.push('6. **Rispondi su quello che chiede**: Se fa una domanda specifica su uno step, non divagare sugli altri');
  
  return lines.join('\n');
}

export function buildOnboardingAgentPrompt(statuses?: OnboardingStatus[]): string {
  return formatOnboardingGuideForPrompt(statuses);
}
