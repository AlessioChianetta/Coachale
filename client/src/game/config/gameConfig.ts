import Phaser from 'phaser';

export const GAME_CONFIG = {
  width: 800,
  height: 600,
  
  // Village layout
  buildings: {
    tower_ai: { x: 400, y: 120, name: 'Torre AI', npc: 'Prof. Gemini', icon: '🏛️', configKey: 'vertex_ai' },
    post_office: { x: 150, y: 250, name: 'Ufficio Postale', npc: 'Postino Pietro', icon: '📮', configKey: 'smtp' },
    clocktower: { x: 650, y: 250, name: 'Orologeria', npc: 'Orologiaio Otto', icon: '📅', configKey: 'google_calendar' },
    twilio_central: { x: 150, y: 400, name: 'Centrale Twilio', npc: 'Operatrice Olivia', icon: '📞', configKey: 'whatsapp_twilio' },
    library: { x: 100, y: 120, name: 'Biblioteca', npc: 'Bibliotecaria Bea', icon: '📚', configKey: 'knowledge_base' },
    school: { x: 700, y: 120, name: 'Scuola', npc: 'Maestro Mario', icon: '🎓', configKey: 'courses' },
    cinema: { x: 100, y: 500, name: 'Cinema', npc: 'Regista Remo', icon: '🎥', configKey: 'video_meeting' },
    portal: { x: 400, y: 500, name: 'Portale Link', npc: 'Guardiano Gabriel', icon: '🔗', configKey: 'public_link' },
    lead_station: { x: 700, y: 500, name: 'Stazione Lead', npc: 'Capostazione Carlo', icon: '👥', configKey: 'lead_import' },
  },
  
  // Agent houses spawn area (dynamic)
  agentQuarter: {
    startX: 300,
    startY: 380,
    spacing: 100,
    maxVisible: 5
  },
  
  // Colors
  colors: {
    locked: 0x666666,
    unlocked: 0x4ade80,
    verified: 0xfbbf24,
    ground: 0x7cb342,
    path: 0xd7ccc8,
    water: 0x4fc3f7
  },
  
  // Player
  player: {
    speed: 200,
    startX: 400,
    startY: 300
  }
};

export const NPC_DIALOGS: Record<string, { greeting: string; configured: string; help: string }> = {
  tower_ai: {
    greeting: "Benvenuto nella Torre AI! Sono il Prof. Gemini. Qui configuriamo il cervello della piattaforma.",
    configured: "Ottimo! Vertex AI è configurato e funzionante. La tua AI è pronta!",
    help: "Per configurare Vertex AI, vai su Google Cloud Console e crea un Service Account..."
  },
  post_office: {
    greeting: "Ciao! Sono Pietro, il postino del villaggio. Mi occupo di tutte le email!",
    configured: "Il servizio email è attivo! Posso inviare email ai tuoi clienti.",
    help: "Per configurare SMTP, ti servono host, porta, username e password del tuo provider email."
  },
  clocktower: {
    greeting: "Tic tac! Sono Otto l'orologiaio. Gestisco tutti gli appuntamenti del villaggio.",
    configured: "Il calendario è sincronizzato! Gli appuntamenti appariranno automaticamente.",
    help: "Clicca su 'Connetti Google Calendar' e autorizza l'accesso."
  },
  twilio_central: {
    greeting: "Pronto? Sono Olivia della Centrale Comunicazioni. Gestisco WhatsApp!",
    configured: "WhatsApp è configurato! Gli agenti possono inviare e ricevere messaggi.",
    help: "Ti servono Account SID, Auth Token e numero WhatsApp da Twilio."
  },
  library: {
    greeting: "Shh... Benvenuto in biblioteca! Sono Bea. Qui conserviamo tutta la conoscenza.",
    configured: "La Knowledge Base è ricca di documenti! L'AI può usarli per rispondere.",
    help: "Carica PDF, Word o testo per arricchire le risposte dell'AI."
  },
  school: {
    greeting: "Buongiorno! Sono il Maestro Mario. Qui creiamo corsi ed esercizi!",
    configured: "Hai già creato contenuti formativi! I tuoi clienti possono imparare.",
    help: "Crea il tuo primo corso o esercizio per iniziare."
  },
  cinema: {
    greeting: "Azione! Sono Remo il regista. Gestisco le videochiamate!",
    configured: "I server TURN sono configurati! Videochiamate stabili garantite.",
    help: "Registrati su Metered.ca e inserisci le credenziali TURN."
  },
  portal: {
    greeting: "Sono Gabriel, guardiano del Portale. Creo link magici per i tuoi clienti!",
    configured: "I link pubblici sono attivi! Condividili ovunque.",
    help: "Genera un link pubblico per permettere ai clienti di contattarti."
  },
  lead_station: {
    greeting: "Tutti a bordo! Sono Carlo, capostazione. Importo lead da tutto il mondo!",
    configured: "L'import automatico è attivo! I lead arrivano da soli.",
    help: "Configura webhook o API per importare lead automaticamente."
  }
};
