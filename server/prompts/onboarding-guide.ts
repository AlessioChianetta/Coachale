import { consultantGuides } from "../consultant-guides";

export type OnboardingStepId = 
  | 'vertex_ai' 
  | 'smtp' 
  | 'google_calendar' 
  | 'twilio' 
  | 'whatsapp_template' 
  | 'first_campaign'
  | 'agent_inbound'
  | 'agent_outbound'
  | 'agent_consultative'
  | 'agent_public_link'
  | 'agent_ideas'
  | 'more_templates'
  | 'first_course'
  | 'first_exercise'
  | 'knowledge_base'
  | 'summary_email'
  | 'turn_config'
  | 'lead_import';

export type OnboardingStepStatus = 'pending' | 'configured' | 'verified' | 'error' | 'skipped';

export interface OnboardingStepInfo {
  id: OnboardingStepId;
  phase: 1 | 2 | 3 | 4;
  title: string;
  content: string;
  isRequired: boolean;
  actionHref?: string;
  tips?: string[];
  warnings?: string[];
}

export const onboardingSteps: OnboardingStepInfo[] = [
  {
    id: 'vertex_ai',
    phase: 1,
    title: '1.1 Vertex AI (Obbligatorio)',
    content: "Configura l'intelligenza artificiale che alimenta l'assistente AI, la generazione email e l'analisi clienti. Vai su Impostazioni → API Esterne → Google Vertex AI.",
    isRequired: true,
    actionHref: '/consultant/api-keys-unified?tab=ai',
    tips: ['Richiede un progetto Google Cloud con Vertex AI abilitato', 'Scarica il file JSON delle credenziali service account'],
    warnings: ["Senza Vertex AI, l'assistente AI e molte funzionalità non funzioneranno"]
  },
  {
    id: 'smtp',
    phase: 1,
    title: '1.2 SMTP Email (Obbligatorio)',
    content: 'Configura il server email per inviare email ai clienti, email di follow-up dopo le consulenze e il journey email automatico.',
    isRequired: true,
    actionHref: '/consultant/api-keys-unified?tab=email',
    tips: ['Puoi usare Gmail, Outlook, o qualsiasi provider SMTP', "Per Gmail: abilita 'App Password' nelle impostazioni sicurezza Google"],
    warnings: ['Senza SMTP non puoi inviare email ai clienti']
  },
  {
    id: 'google_calendar',
    phase: 1,
    title: '1.3 Google Calendar (Opzionale)',
    content: 'Collega Google Calendar ai tuoi agenti WhatsApp per sincronizzare automaticamente gli appuntamenti prenotati.',
    isRequired: false,
    actionHref: '/consultant/whatsapp',
    tips: ['Ogni agente può avere il proprio Google Calendar', "Collega il calendario dal pannello laterale dell'agente"]
  },
  {
    id: 'twilio',
    phase: 1,
    title: '1.4 Configurazione Twilio + WhatsApp (Obbligatorio per WhatsApp)',
    content: "Configura Twilio per abilitare l'invio e ricezione di messaggi WhatsApp. Necessario per usare gli agenti AI e le campagne marketing.",
    isRequired: true,
    actionHref: '/consultant/api-keys-unified?tab=twilio',
    tips: ['Crea account su twilio.com', 'Richiedi WhatsApp Business API', 'Inserisci Account SID, Auth Token e numero WhatsApp'],
    warnings: ['Processo di approvazione Meta può richiedere alcuni giorni', 'Senza Twilio non puoi usare WhatsApp']
  },
  {
    id: 'whatsapp_template',
    phase: 1,
    title: '1.5 Template WhatsApp Approvato (ESSENZIALE)',
    content: 'Crea e fai approvare almeno un template WhatsApp da Twilio. I template sono OBBLIGATORI per inviare messaggi proattivi ai lead.',
    isRequired: true,
    actionHref: '/consultant/whatsapp-templates',
    tips: ["Crea un template con categoria 'Primo Contatto' o 'Setter'", 'Usa variabili come {{1}} per personalizzare i messaggi', "L'approvazione Twilio richiede da pochi minuti a 24 ore"],
    warnings: ['SENZA TEMPLATE APPROVATO non puoi inviare messaggi proattivi', 'I template rifiutati devono essere corretti e ri-sottomessi']
  },
  {
    id: 'first_campaign',
    phase: 1,
    title: '1.6 Crea la tua Prima Campagna (ESSENZIALE)',
    content: 'Configura la tua prima campagna marketing usando il wizard a 3 step. La campagna collega: Fonti Lead → Template WhatsApp → Agente AI.',
    isRequired: true,
    actionHref: '/consultant/campaigns',
    tips: ['Scegli un nome descrittivo per la campagna', "Seleziona l'agente WhatsApp che gestirà le conversazioni", 'Scegli il template approvato per il primo messaggio'],
    warnings: ['Richiede almeno un template approvato', "L'agente deve avere Twilio configurato"]
  },
  {
    id: 'agent_inbound',
    phase: 2,
    title: '2.1 Agente Inbound',
    content: "L'agente Inbound risponde automaticamente ai lead che ti contattano. Gestisce domande frequenti, qualifica i lead e può prenotare appuntamenti.",
    isRequired: false,
    actionHref: '/consultant/whatsapp/agent/new?type=inbound',
    tips: ['Ideale per rispondere 24/7 senza intervento manuale', 'Personalizza il tono e le risposte'],
    warnings: ['Richiede Twilio configurato']
  },
  {
    id: 'agent_outbound',
    phase: 2,
    title: '2.2 Agente Outbound',
    content: "L'agente Outbound contatta proattivamente i lead delle tue campagne. Segue script personalizzati per qualificare e convertire.",
    isRequired: false,
    actionHref: '/consultant/whatsapp/agent/new?type=outbound',
    tips: ['Usalo con le campagne marketing', "Definisci 'uncini' per catturare l'attenzione"]
  },
  {
    id: 'agent_consultative',
    phase: 2,
    title: '2.3 Agente Consulenziale',
    content: "L'agente Consultivo assiste durante le sessioni con i clienti. Può rispondere a domande tecniche usando la knowledge base.",
    isRequired: false,
    actionHref: '/consultant/whatsapp/agent/new?type=consultative',
    tips: ['Collega alla Knowledge Base per risposte accurate', 'Utile per supporto post-consulenza']
  },
  {
    id: 'agent_public_link',
    phase: 2,
    title: '2.4 Link Pubblico Agente',
    content: 'Una volta creato un agente, genera un link pubblico che i potenziali clienti possono usare per iniziare una conversazione con il tuo bot.',
    isRequired: false,
    actionHref: '/consultant/whatsapp-agents-chat',
    tips: ['Il link può essere condiviso su social, sito web, biglietti da visita', 'Il lead viene automaticamente aggiunto alla pipeline']
  },
  {
    id: 'agent_ideas',
    phase: 2,
    title: '2.5 Idee AI Generate',
    content: "L'AI può generare idee creative per i tuoi agenti basandosi sul tuo settore e target.",
    isRequired: false,
    actionHref: '/consultant/whatsapp?tab=ideas',
    tips: ["Descrivi il tuo target e l'AI suggerirà contenuti", 'Puoi modificare e personalizzare i suggerimenti']
  },
  {
    id: 'more_templates',
    phase: 2,
    title: '2.6 Altri Template WhatsApp',
    content: 'Crea template aggiuntivi per follow-up, promemoria appuntamenti, e altre comunicazioni automatiche.',
    isRequired: false,
    actionHref: '/consultant/whatsapp-templates',
    tips: ['Usa categorie diverse: Follow-up, Appuntamenti, Generale', 'Ogni template deve essere approvato da Twilio']
  },
  {
    id: 'first_course',
    phase: 3,
    title: '3.1 Primo Corso',
    content: 'Crea il tuo primo corso formativo per i clienti. Struttura in moduli e lezioni con video, testo e quiz.',
    isRequired: false,
    actionHref: '/consultant/university',
    tips: ['I clienti possono seguire i corsi dalla loro area', 'Traccia i progressi e il completamento']
  },
  {
    id: 'first_exercise',
    phase: 3,
    title: '3.2 Primo Esercizio',
    content: 'Crea esercizi pratici che i clienti devono completare. Ricevi notifiche quando vengono consegnati per la revisione.',
    isRequired: false,
    actionHref: '/consultant/exercise-templates',
    tips: ['Gli esercizi aiutano i clienti ad applicare quanto appreso', 'Puoi impostare scadenze e priorità']
  },
  {
    id: 'knowledge_base',
    phase: 3,
    title: '3.3 Base di Conoscenza',
    content: "Carica documenti, PDF, e contenuti che l'AI userà per rispondere alle domande. Più informazioni carichi, più accurate saranno le risposte.",
    isRequired: false,
    actionHref: '/consultant/knowledge-documents',
    tips: ['Carica PDF, documenti Word, o testo', "L'AI indicizza automaticamente i contenuti", "Usato sia dall'assistente che dagli agenti WhatsApp"]
  },
  {
    id: 'summary_email',
    phase: 4,
    title: '4.1 Prima Email Riassuntiva',
    content: "Dopo una consulenza, genera automaticamente un'email di riepilogo con i punti chiave discussi e i prossimi passi.",
    isRequired: false,
    actionHref: '/consultant/appointments',
    tips: ["L'AI genera la bozza basandosi sulle note della consulenza", 'Puoi modificare prima di inviare']
  },
  {
    id: 'turn_config',
    phase: 4,
    title: '4.2 Video Meeting (TURN)',
    content: 'Configura Metered.ca per videochiamate WebRTC affidabili con i tuoi clienti.',
    isRequired: false,
    actionHref: '/consultant/api-keys-unified?tab=video-meeting',
    tips: ['I link Meet vengono generati automaticamente per le consulenze', 'Integrazione con Fathom per trascrizioni automatiche']
  },
  {
    id: 'lead_import',
    phase: 4,
    title: '4.3 Import Lead Automatico',
    content: 'Configura API esterne per importare lead automaticamente da altre piattaforme nel sistema.',
    isRequired: false,
    actionHref: '/consultant/api-keys-unified?tab=lead-import',
    tips: ['Connetti fonti come Facebook Ads, Google Ads, landing page']
  }
];

export function getOnboardingStepById(id: OnboardingStepId): OnboardingStepInfo | undefined {
  return onboardingSteps.find(step => step.id === id);
}

export function getOnboardingStepsByPhase(phase: 1 | 2 | 3 | 4): OnboardingStepInfo[] {
  return onboardingSteps.filter(step => step.phase === phase);
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
  
  const lines: string[] = [
    '# GUIDA ONBOARDING - Setup Wizard',
    '',
    'Sei l\'Assistente Onboarding della piattaforma. Aiuti i consulenti a completare la configurazione iniziale.',
    '',
    '## Le 4 Fasi del Setup',
    ''
  ];
  
  for (let phase = 1; phase <= 4; phase++) {
    const phaseNames: Record<number, string> = {
      1: 'INFRASTRUTTURA BASE + WHATSAPP',
      2: 'AGENTI WHATSAPP AVANZATI',
      3: 'CONTENUTI',
      4: 'AVANZATO'
    };
    
    const phaseIcons: Record<number, string> = {
      1: '🔧',
      2: '🤖',
      3: '📚',
      4: '⚡'
    };
    
    lines.push(`### ${phaseIcons[phase]} FASE ${phase}: ${phaseNames[phase]}`);
    lines.push('');
    
    const phaseSteps = getOnboardingStepsByPhase(phase as 1 | 2 | 3 | 4);
    for (const step of phaseSteps) {
      const status = statusMap.get(step.id) || 'pending';
      const emoji = statusEmoji[status];
      const requiredTag = step.isRequired ? ' [OBBLIGATORIO]' : '';
      
      lines.push(`${emoji} **${step.title}**${requiredTag}`);
      lines.push(`   ${step.content}`);
      
      if (step.tips && step.tips.length > 0) {
        lines.push(`   💡 Tips: ${step.tips.join(' | ')}`);
      }
      
      if (step.warnings && step.warnings.length > 0) {
        lines.push(`   ⚠️ Attenzione: ${step.warnings.join(' | ')}`);
      }
      
      if (step.actionHref) {
        lines.push(`   🔗 Link: ${step.actionHref}`);
      }
      
      lines.push('');
    }
  }
  
  lines.push('## Come Aiutare l\'Utente');
  lines.push('');
  lines.push('1. **Identifica lo stato attuale**: Guarda quali step sono ✅ completati e quali ⚪ da fare');
  lines.push('2. **Suggerisci il prossimo passo**: Indica lo step successivo più importante');
  lines.push('3. **Fornisci istruzioni dettagliate**: Spiega come completare ogni step');
  lines.push('4. **Risolvi problemi**: Se uno step ha 🔴 errore, aiuta a risolverlo');
  lines.push('5. **Usa i link**: Indica il percorso esatto per raggiungere la pagina di configurazione');
  lines.push('');
  lines.push('## Priorità');
  lines.push('');
  lines.push('Gli step OBBLIGATORI della Fase 1 devono essere completati per primi:');
  lines.push('1. Vertex AI - senza questo l\'AI non funziona');
  lines.push('2. SMTP - necessario per inviare email');
  lines.push('3. Twilio + WhatsApp - necessario per gli agenti');
  lines.push('4. Template WhatsApp approvato - necessario per messaggi proattivi');
  lines.push('5. Prima Campagna - per iniziare a contattare lead');
  
  return lines.join('\n');
}

export function buildOnboardingAgentPrompt(statuses?: OnboardingStatus[]): string {
  return formatOnboardingGuideForPrompt(statuses);
}
