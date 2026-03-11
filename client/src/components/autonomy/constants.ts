import alessiaAvatar from "@assets/generated_images/alessia_ai_voice_consultant_avatar.png";
import millieAvatar from "@assets/generated_images/millie_ai_email_assistant_avatar.png";
import echoAvatar from "@assets/generated_images/echo_ai_summarizer_avatar.png";
import stellaAvatar from "@assets/generated_images/stella_ai_whatsapp_assistant_avatar.png";
import novaAvatar from "@assets/generated_images/nova_ai_social_media_avatar.png";
import marcoAvatar from "@assets/generated_images/marco_ai_executive_coach_avatar.png";
import hunterAvatar from "@assets/generated_images/spec_ai_researcher_avatar.png";
import robertAvatar from "@assets/generated_images/robert_ai_sales_coach_avatar.png";
import archieAvatar from "@assets/generated_images/archie_ai_builder_avatar.png";
import type { AutonomySettings, TaskLibraryItem, NewTaskData } from "./types";

export const DAYS_OF_WEEK = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mer" },
  { value: 4, label: "Gio" },
  { value: 5, label: "Ven" },
  { value: 6, label: "Sab" },
  { value: 7, label: "Dom" },
];

export const TASK_CATEGORIES = [
  { value: "outreach", label: "Contatto", description: "Contattare nuovi o esistenti clienti" },
  { value: "reminder", label: "Promemoria", description: "Ricordare scadenze, appuntamenti, pagamenti" },
  { value: "followup", label: "Follow-up", description: "Ricontattare dopo consulenze o eventi" },
  { value: "analysis", label: "Analisi", description: "Analizzare dati finanziari e pattern del cliente" },
  { value: "report", label: "Report", description: "Generare report e documenti di analisi" },
  { value: "research", label: "Ricerca", description: "Ricercare informazioni di mercato e normative" },
  { value: "preparation", label: "Preparazione", description: "Preparare materiale per consulenze e incontri" },
  { value: "monitoring", label: "Monitoraggio", description: "Monitorare proattivamente situazioni e scadenze clienti" },
  { value: "scheduling", label: "Schedulazione", description: "Monitorare e ricordare la programmazione delle consulenze" },
  { value: "prospecting", label: "Prospecting", description: "Ricerca e qualifica automatica di nuovi lead" },
];

export const TASK_LIBRARY: TaskLibraryItem[] = [
  {
    id: "outreach-call",
    icon: "📞",
    title: "Chiamata commerciale",
    description: "Contatta il cliente per presentare i tuoi servizi e proporre un appuntamento conoscitivo",
    category: "outreach",
    instruction: "Contatta il cliente per presentare i servizi disponibili e proporre un appuntamento conoscitivo",
    preferred_channel: "voice",
    tone: "persuasivo",
    objective: "vendere",
    priority: 2,
    voice_template_suggestion: "sales-orbitale",
  },
  {
    id: "outreach-email",
    icon: "📧",
    title: "Email di presentazione",
    description: "Invia un'email professionale per presentare i tuoi servizi e invitare a fissare un incontro",
    category: "outreach",
    instruction: "Invia un'email professionale di presentazione dei servizi offerti, evidenziando i vantaggi e invitando a fissare un appuntamento",
    preferred_channel: "email",
    tone: "professionale",
    objective: "vendere",
    priority: 3,
  },
  {
    id: "outreach-whatsapp",
    icon: "💬",
    title: "Messaggio WhatsApp",
    description: "Invia un messaggio WhatsApp breve e cordiale per presentarsi e proporre un primo contatto",
    category: "outreach",
    instruction: "Invia un messaggio WhatsApp breve e cordiale per presentarsi e proporre una prima consulenza gratuita",
    preferred_channel: "whatsapp",
    tone: "informale",
    objective: "vendere",
    priority: 3,
  },
  {
    id: "followup-post-consulenza",
    icon: "🔄",
    title: "Follow-up post incontro",
    description: "Ricontatta il cliente dopo l'ultimo incontro per raccogliere feedback e proporre i prossimi passi",
    category: "followup",
    instruction: "Ricontatta il cliente dopo l'ultimo incontro per verificare se ha domande, raccogliere feedback e proporre i prossimi passi",
    preferred_channel: "voice",
    tone: "empatico",
    objective: "fidelizzare",
    priority: 2,
    voice_template_suggestion: "follow-up-lead",
  },
  {
    id: "followup-email",
    icon: "📩",
    title: "Follow-up email",
    description: "Invia un'email di follow-up con il riepilogo dei punti discussi e le azioni concordate",
    category: "followup",
    instruction: "Invia un'email di follow-up dopo l'incontro con un riepilogo dei punti discussi e le azioni concordate",
    preferred_channel: "email",
    tone: "professionale",
    objective: "fidelizzare",
    priority: 3,
  },
  {
    id: "followup-sollecito",
    icon: "🔔",
    title: "Sollecito pagamento",
    description: "Contatta il cliente per ricordare gentilmente un pagamento in sospeso e offrire assistenza",
    category: "followup",
    instruction: "Contatta il cliente per ricordare gentilmente un pagamento in sospeso e offrire assistenza per il saldo",
    preferred_channel: "voice",
    tone: "formale",
    objective: "raccogliere_info",
    priority: 1,
    voice_template_suggestion: "recupero-crediti",
  },
  {
    id: "reminder-scadenza",
    icon: "⏰",
    title: "Scadenza contratto",
    description: "Avvisa il cliente di una scadenza imminente e suggerisci una revisione o un rinnovo",
    category: "reminder",
    instruction: "Avvisa il cliente della prossima scadenza del suo contratto o servizio attivo e suggerisci una revisione insieme",
    preferred_channel: "voice",
    tone: "professionale",
    objective: "informare",
    priority: 2,
  },
  {
    id: "reminder-appuntamento",
    icon: "📅",
    title: "Promemoria appuntamento",
    description: "Ricorda al cliente l'appuntamento programmato e conferma la sua disponibilità",
    category: "reminder",
    instruction: "Ricorda al cliente l'appuntamento programmato e conferma la sua disponibilità",
    preferred_channel: "whatsapp",
    tone: "informale",
    objective: "informare",
    priority: 1,
  },
  {
    id: "analysis-cliente",
    icon: "📊",
    title: "Analisi cliente",
    description: "Analizza lo storico del cliente, identifica pattern nelle interazioni e genera raccomandazioni strategiche",
    category: "analysis",
    instruction: "Analizza lo storico del cliente, identifica pattern nelle interazioni passate e genera raccomandazioni strategiche per migliorare il rapporto",
    tone: "professionale",
    objective: "informare",
    priority: 2,
  },
  {
    id: "report-mensile",
    icon: "📋",
    title: "Report mensile",
    description: "Genera un report mensile dettagliato con un riepilogo delle attività, risultati e prossimi passi",
    category: "report",
    instruction: "Genera un report mensile dettagliato con il riepilogo delle attività svolte, i risultati ottenuti e le raccomandazioni per il mese prossimo",
    tone: "professionale",
    objective: "informare",
    priority: 3,
  },
  {
    id: "research-settore",
    icon: "🔍",
    title: "Ricerca di settore",
    description: "Cerca e analizza le ultime tendenze, normative e opportunità rilevanti per il tuo settore",
    category: "research",
    instruction: "Cerca e analizza le ultime tendenze di settore, normative aggiornate e opportunità rilevanti per i clienti",
    tone: "professionale",
    objective: "informare",
    priority: 3,
  },
  {
    id: "monitoring-checkin",
    icon: "💚",
    title: "Check-in periodico",
    description: "Effettua un check-in di cortesia con il cliente per mantenere il rapporto e verificare la soddisfazione",
    category: "monitoring",
    instruction: "Effettua un check-in di cortesia con il cliente per verificare il suo stato, rispondere a domande e mantenere il rapporto",
    preferred_channel: "voice",
    tone: "empatico",
    objective: "fidelizzare",
    priority: 3,
    voice_template_suggestion: "check-in-cliente",
  },
  {
    id: "monitoring-proattivo",
    icon: "👀",
    title: "Monitoraggio proattivo",
    description: "Monitora la situazione del cliente, verifica scadenze imminenti e segnala eventuali criticità",
    category: "monitoring",
    instruction: "Monitora la situazione del cliente, verifica scadenze imminenti e segnala eventuali criticità che richiedono attenzione",
    tone: "professionale",
    objective: "supporto",
    priority: 2,
  },
  {
    id: "preparation-consulenza",
    icon: "📝",
    title: "Preparazione incontro",
    description: "Prepara materiale e dossier per il prossimo incontro: situazione attuale, obiettivi e proposte",
    category: "preparation",
    instruction: "Prepara materiale e dossier per il prossimo incontro con il cliente: analisi situazione attuale, obiettivi e proposte da discutere",
    tone: "professionale",
    objective: "informare",
    priority: 2,
  },
];

export const AI_ROLE_PROFILES: Record<string, { avatar: string; quote: string; role: string }> = {
  alessia: { avatar: alessiaAvatar, quote: "Analizzo le consultazioni e i follow-up vocali per non perdere mai un cliente.", role: "Voice Consultant" },
  millie: { avatar: millieAvatar, quote: "Gestisco tutte le email in arrivo — clienti, lead e contatti esterni — con risposte intelligenti e personalizzate.", role: "Email Writer" },
  echo: { avatar: echoAvatar, quote: "Trasformo le tue consulenze in riepiloghi strutturati.", role: "Summarizer" },
  nova: { avatar: novaAvatar, quote: "Gestisco i tuoi social e il calendario editoriale.", role: "Social Media Manager" },
  stella: { avatar: stellaAvatar, quote: "Monitoro le conversazioni WhatsApp e suggerisco azioni.", role: "WhatsApp Assistant" },
  marco: { avatar: marcoAvatar, quote: "Ti spingo oltre i tuoi limiti. Niente scuse, solo risultati.", role: "Executive Coach" },
  robert: { avatar: robertAvatar, quote: "Ti insegno a vendere i pacchetti come un professionista. Niente teoria — solo chiusure.", role: "Sales Coach" },
  hunter: { avatar: hunterAvatar, quote: "Trovo i lead migliori e li passo al team per il primo contatto.", role: "Lead Prospector" },
  architetto: { avatar: archieAvatar, quote: "Progetto funnel di conversione basati sulla tua ricerca di mercato e brand voice.", role: "Funnel Architect" },
  personalizza: { avatar: "", quote: "Configurami come vuoi: definisci tu le mie regole.", role: "Assistente Custom" },
};

export const AI_ROLE_ACCENT_COLORS: Record<string, { ring: string; badge: string; border: string; text: string }> = {
  pink: { ring: "ring-pink-400", badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300", border: "border-pink-300 dark:border-pink-700", text: "text-pink-600 dark:text-pink-400" },
  purple: { ring: "ring-purple-400", badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300", border: "border-purple-300 dark:border-purple-700", text: "text-purple-600 dark:text-purple-400" },
  orange: { ring: "ring-orange-400", badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300", border: "border-orange-300 dark:border-orange-700", text: "text-orange-600 dark:text-orange-400" },
  emerald: { ring: "ring-emerald-400", badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300", border: "border-emerald-300 dark:border-emerald-700", text: "text-emerald-600 dark:text-emerald-400" },
  teal: { ring: "ring-teal-400", badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300", border: "border-teal-300 dark:border-teal-700", text: "text-teal-600 dark:text-teal-400" },
  indigo: { ring: "ring-indigo-400", badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300", border: "border-indigo-300 dark:border-indigo-700", text: "text-indigo-600 dark:text-indigo-400" },
  amber: { ring: "ring-amber-400", badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300", border: "border-amber-300 dark:border-amber-700", text: "text-amber-600 dark:text-amber-400" },
  cyan: { ring: "ring-cyan-400", badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300", border: "border-cyan-300 dark:border-cyan-700", text: "text-cyan-600 dark:text-cyan-400" },
  gray: { ring: "ring-gray-400", badge: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300", border: "border-gray-300 dark:border-gray-700", text: "text-gray-600 dark:text-gray-400" },
};

export interface ExecutionPipelineStep {
  id: string;
  icon: string;
  label: string;
  description: string;
}

export interface ExecutionPipelineInfo {
  steps: ExecutionPipelineStep[];
  direction: string;
  directionIcon: string;
  directionColor: string;
}

export const AI_ROLE_EXECUTION_PIPELINES: Record<string, ExecutionPipelineInfo> = {
  alessia: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Recupera storico consulenze, chiamate e interazioni del cliente" },
      { id: "search_private_stores", icon: "🔎", label: "Ricerca documenti", description: "Cerca nei documenti privati del cliente (note, email, report)" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi AI", description: "Analizza i pattern di engagement e identifica bisogni" },
      { id: "prepare_call", icon: "📝", label: "Preparazione script", description: "Crea i punti di discussione e lo script per la chiamata" },
      { id: "voice_call", icon: "📞", label: "Chiamata vocale", description: "Esegue la chiamata telefonica con voce AI naturale via Twilio" },
    ],
    direction: "Contatta il CLIENTE",
    directionIcon: "👤",
    directionColor: "text-pink-600 dark:text-pink-400",
  },
  millie: {
    steps: [
      { id: "identify_contact", icon: "🔍", label: "Identifica contatto", description: "Riconosce il mittente: cliente, lead CRM o contatto esterno" },
      { id: "crm_context", icon: "📊", label: "Contesto CRM e cross-canale", description: "Arricchisce con dati CRM, WhatsApp, chiamate e storico interazioni" },
      { id: "classify_intent", icon: "🧠", label: "Classifica e analizza intent", description: "Determina tipo email, urgenza, sentiment e intent del messaggio" },
      { id: "generate_response", icon: "✍️", label: "Genera risposta adattiva", description: "Crea bozza personalizzata usando KB, Profilo Commerciale e contesto" },
      { id: "auto_actions", icon: "⚡", label: "Azioni automatiche", description: "Invio automatico, creazione ticket o escalation in base alla confidenza" },
    ],
    direction: "Gestisce email in arrivo (clienti, lead, esterni)",
    directionIcon: "📨",
    directionColor: "text-purple-600 dark:text-purple-400",
  },
  stella: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Recupera storico conversazioni WhatsApp del contatto" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi conversazioni", description: "Analizza il contesto e identifica il messaggio appropriato" },
      { id: "send_whatsapp", icon: "💬", label: "Invio WhatsApp", description: "Invia messaggio WhatsApp via Twilio (template o testo libero)" },
    ],
    direction: "Contatta il CLIENTE",
    directionIcon: "👤",
    directionColor: "text-emerald-600 dark:text-emerald-400",
  },
  echo: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Recupera i dettagli della consulenza (note, trascrizioni)" },
      { id: "search_private_stores", icon: "🔎", label: "Ricerca documenti", description: "Cerca nei documenti privati del cliente" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi contenuti", description: "Analizza i punti trattati, decisioni e azioni concordate" },
      { id: "generate_report", icon: "📄", label: "Generazione riepilogo", description: "Crea un riepilogo strutturato con punti chiave e prossimi step" },
      { id: "send_email", icon: "📧", label: "Invio riepilogo", description: "Invia il riepilogo via email al cliente con PDF allegato" },
    ],
    direction: "Contatta il CLIENTE",
    directionIcon: "👤",
    directionColor: "text-orange-600 dark:text-orange-400",
  },
  nova: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Analizza il calendario editoriale e i contenuti recenti" },
      { id: "web_search", icon: "🌐", label: "Ricerca trend", description: "Cerca trend e argomenti rilevanti nel settore sul web" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi e ideazione", description: "Genera idee per nuovi contenuti basati sui dati raccolti" },
      { id: "generate_report", icon: "📝", label: "Generazione contenuto", description: "Crea il contenuto con testo, hashtag e suggerimenti visivi" },
    ],
    direction: "Nessun contatto diretto (solo contenuti interni)",
    directionIcon: "🏠",
    directionColor: "text-muted-foreground",
  },
  marco: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Legge roadmap, obiettivi, documenti KB e agenda" },
      { id: "search_private_stores", icon: "🔎", label: "Ricerca documenti", description: "Cerca nei documenti strategici e nella Knowledge Base" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi strategica", description: "Valuta progressi, criticita e opportunita di crescita" },
      { id: "generate_report", icon: "📄", label: "Preparazione coaching", description: "Prepara i punti di discussione e le sfide su cui spingerti" },
      { id: "contact", icon: "📞💬📧", label: "Contatto diretto", description: "Ti chiama, manda WhatsApp o email in base all'urgenza" },
    ],
    direction: "Contatta TE (il consulente) — mai i clienti",
    directionIcon: "🎯",
    directionColor: "text-indigo-600 dark:text-indigo-400",
  },
  robert: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Analizza stato piattaforma, clienti attivi e moduli configurati" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi vendita", description: "Identifica opportunità di upsell, cross-sell e nuovi pacchetti da proporre" },
      { id: "generate_report", icon: "📝", label: "Strategia vendita", description: "Prepara consigli specifici su come vendere e posizionare i pacchetti" },
      { id: "contact", icon: "💬📧", label: "Coaching diretto", description: "Ti contatta con frasi killer, obiezioni gestite e strategie concrete" },
    ],
    direction: "Contatta TE (il consulente) — coaching vendita proattivo",
    directionIcon: "🎯",
    directionColor: "text-amber-600 dark:text-amber-400",
  },
  hunter: {
    steps: [
      { id: "lead_scraper_search", icon: "🔍", label: "Ricerca lead", description: "Cerca nuovi lead su Google Maps/Search in base al Sales Context" },
      { id: "scrape", icon: "🌐", label: "Scraping siti", description: "Visita i siti web trovati per estrarre email, telefoni e info aziendali" },
      { id: "qualify", icon: "🎯", label: "Qualifica AI", description: "Analizza ogni lead con AI, assegna score (0-100) e crea panoramica aziendale" },
      { id: "lead_qualify_and_assign", icon: "🗓️", label: "Scheduling", description: "Hunter schedula direttamente chiamate, messaggi WhatsApp ed email a calendario" },
      { id: "outreach", icon: "⚡", label: "Outreach diretto", description: "Hunter esegue il contatto in autonomia: chiama, scrive su WA, manda email" },
    ],
    direction: "Autonomia completa — Hunter gestisce tutto il ciclo da solo",
    directionIcon: "⚡",
    directionColor: "text-violet-600 dark:text-violet-400",
  },
  architetto: {
    steps: [
      { id: "read_brand_research", icon: "📚", label: "Legge Brand & Ricerca", description: "Carica brand voice, identità e ricerca di mercato dal template selezionato" },
      { id: "discovery", icon: "🔍", label: "Discovery", description: "Fa domande strategiche per capire obiettivi e struttura del funnel" },
      { id: "generate_funnel", icon: "🏗️", label: "Generazione Funnel", description: "Genera la struttura del funnel con nodi, copy e logica di conversione" },
      { id: "iterate", icon: "🔄", label: "Iterazione", description: "Raffina il funnel in base al tuo feedback e ai dati di mercato" },
    ],
    direction: "Lavora CON te — strategia funnel",
    directionIcon: "🤝",
    directionColor: "text-cyan-600 dark:text-cyan-400",
  },
  personalizza: {
    steps: [
      { id: "fetch_client_data", icon: "📊", label: "Raccolta dati", description: "Recupera i dati configurati nelle tue istruzioni" },
      { id: "analyze_patterns", icon: "🧠", label: "Analisi AI", description: "Analizza secondo le regole personalizzate" },
      { id: "action", icon: "⚡", label: "Azione configurata", description: "Esegue l'azione definita nelle tue istruzioni (email, report, etc.)" },
    ],
    direction: "Dipende dalla configurazione personalizzata",
    directionIcon: "⚙️",
    directionColor: "text-muted-foreground",
  },
};

export const AI_ROLE_CAPABILITIES: Record<string, {
  canDo: Array<{ icon: string; text: string }>;
  cantDo: Array<{ icon: string; text: string }>;
  workflow: string;
}> = {
  alessia: {
    canDo: [
      { icon: "📊", text: "Analizza lo storico delle tue consulenze" },
      { icon: "📞", text: "Crea task per chiamate vocali AI ai clienti" },
      { icon: "🔍", text: "Cerca informazioni nei Private Store dei clienti" },
      { icon: "🧠", text: "Identifica chi non senti da troppo tempo" },
      { icon: "📋", text: "Prepara istruzioni dettagliate per ogni chiamata" },
      { icon: "⏰", text: "Decide autonomamente quando serve un follow-up telefonico" },
    ],
    cantDo: [
      { icon: "📧", text: "Non può inviare email" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp" },
      { icon: "📱", text: "Non può gestire i social media" },
      { icon: "📝", text: "Non può creare riepiloghi consulenze" },
    ],
    workflow: "Ogni 30 minuti → Legge consulenze e chiamate → Identifica clienti da ricontattare → Crea task chiamata vocale",
  },
  millie: {
    canDo: [
      { icon: "📨", text: "Gestisce tutte le email in arrivo: clienti, lead Hunter e contatti esterni" },
      { icon: "🔍", text: "Identifica il mittente tramite CRM, Lead Scraper e anagrafica clienti" },
      { icon: "📊", text: "Arricchisce il contesto con storico WhatsApp, chiamate e interazioni cross-canale" },
      { icon: "🧠", text: "Classifica email per tipo, urgenza, sentiment e intent" },
      { icon: "✍️", text: "Genera risposte adattive in base al tipo di contatto e alla situazione" },
      { icon: "📄", text: "Consulta i documenti FileSearch privati dei clienti registrati" },
      { icon: "💼", text: "Usa il Profilo Commerciale dell'account per risposte accurate" },
      { icon: "📈", text: "Monitora il journey email e l'engagement dei clienti" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può fare chiamate vocali" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp" },
      { icon: "📱", text: "Non può gestire i social media" },
    ],
    workflow: "Email in arrivo → Identifica contatto (CRM/Lead/Cliente) → Arricchisce contesto cross-canale → Classifica e analizza intent → Genera risposta adattiva → Azioni automatiche",
  },
  echo: {
    canDo: [
      { icon: "📝", text: "Genera riepiloghi strutturati delle consulenze" },
      { icon: "🎙️", text: "Analizza trascrizioni e note delle sessioni" },
      { icon: "🔍", text: "Cerca informazioni nei Private Store dei clienti" },
      { icon: "📧", text: "Crea task per inviare il riepilogo al cliente via email" },
      { icon: "📋", text: "Crea report professionali post-sessione" },
      { icon: "🧠", text: "Prioritizza consulenze urgenti da riepilogare" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può fare chiamate vocali" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp" },
      { icon: "📱", text: "Non può gestire i social media" },
      { icon: "🔄", text: "Non può creare follow-up autonomi" },
    ],
    workflow: "Ogni 30 minuti → Trova consulenze senza riepilogo → Analizza note e trascrizioni → Crea task riepilogo + invio email",
  },
  nova: {
    canDo: [
      { icon: "📱", text: "Analizza il tuo calendario editoriale" },
      { icon: "💡", text: "Suggerisce idee per nuovi contenuti" },
      { icon: "🌐", text: "Ricerca trend del settore sul web" },
      { icon: "📊", text: "Monitora la frequenza delle pubblicazioni" },
      { icon: "📝", text: "Propone post con hook e call-to-action" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può contattare clienti singoli" },
      { icon: "📧", text: "Non può inviare email ai clienti" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp" },
      { icon: "📤", text: "Non pubblica direttamente sui social" },
    ],
    workflow: "Ogni 30 minuti → Analizza post recenti e gap nel calendario → Identifica opportunità → Crea task per nuovo contenuto",
  },
  stella: {
    canDo: [
      { icon: "💬", text: "Monitora tutte le conversazioni WhatsApp" },
      { icon: "👤", text: "Qualifica i lead non ancora gestiti" },
      { icon: "🔔", text: "Identifica messaggi senza risposta" },
      { icon: "📝", text: "Prepara risposte con contesto e tono giusto" },
      { icon: "🧠", text: "Decide chi ricontattare via WhatsApp" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può fare chiamate vocali" },
      { icon: "📧", text: "Non può inviare email" },
      { icon: "📱", text: "Non può gestire i social media" },
    ],
    workflow: "Ogni 30 minuti → Legge conversazioni WhatsApp → Trova messaggi senza risposta e lead → Crea task messaggio WhatsApp",
  },
  marco: {
    canDo: [
      { icon: "🔥", text: "Ti spinge a raggiungere gli obiettivi strategici, senza scuse" },
      { icon: "🗺️", text: "Legge la roadmap e i documenti KB per tenerti sulla rotta" },
      { icon: "📅", text: "Analizza l'agenda e ti chiama se non stai facendo abbastanza" },
      { icon: "📞", text: "Ti chiama, ti manda WhatsApp, ti scrive email per farti muovere" },
      { icon: "⚡", text: "Ti stressa se sei in ritardo su obiettivi o scadenze" },
      { icon: "📊", text: "Monitora performance e carico di lavoro in tempo reale" },
      { icon: "📋", text: "Prepara briefing pre-consulenza con contesto completo" },
      { icon: "🎯", text: "Verifica che ogni azione sia allineata alla crescita dell'attività" },
      { icon: "💪", text: "Tono informale e diretto — come un socio che ti parla chiaro" },
    ],
    cantDo: [
      { icon: "📞", text: "Non contatta clienti direttamente — lavora solo su di te" },
      { icon: "📧", text: "Non invia email ai clienti" },
      { icon: "💬", text: "Non manda messaggi WhatsApp ai clienti" },
    ],
    workflow: "Ogni 30 minuti → Legge roadmap, obiettivi, documenti KB, agenda e dati reali → Valuta se stai facendo abbastanza per scalare → Ti chiama/scrive per spingerti ad agire",
  },
  robert: {
    canDo: [
      { icon: "🎯", text: "Ti insegna a vendere i 10 pacchetti servizio della piattaforma" },
      { icon: "💡", text: "Identifica opportunità di upsell e cross-sell tra i tuoi clienti" },
      { icon: "🗣️", text: "Ti prepara con frasi killer, gestione obiezioni e tecniche di chiusura" },
      { icon: "📊", text: "Analizza lo stato della piattaforma e suggerisce cosa vendere per primo" },
      { icon: "💬", text: "Ti contatta via WhatsApp con consigli di vendita rapidi e mirati" },
      { icon: "📧", text: "Ti manda email con strategie di vendita dettagliate" },
      { icon: "🔥", text: "Tono diretto e provocatorio — come un coach di vendita al bar" },
      { icon: "📋", text: "Monitora i moduli da configurare e li trasforma in opportunità di vendita" },
    ],
    cantDo: [
      { icon: "📞", text: "Non contatta i clienti direttamente — lavora solo su di te" },
      { icon: "🤝", text: "Non gestisce trattative — ti prepara per chiuderle tu" },
      { icon: "📱", text: "Non gestisce i social media" },
    ],
    workflow: "Ogni ciclo → Analizza stato piattaforma e clienti attivi → Identifica opportunità vendita e upsell → Ti contatta con strategie concrete e frasi killer",
  },
  hunter: {
    canDo: [
      { icon: "🔍", text: "Cerca automaticamente nuovi lead su Google Maps e Search" },
      { icon: "🌐", text: "Analizza i siti web dei lead trovati con scraping AI" },
      { icon: "📊", text: "Valuta e qualifica i lead con score di compatibilità e panoramica aziendale" },
      { icon: "📞", text: "Schedula e avvia chiamate vocali ai lead qualificati" },
      { icon: "💬", text: "Schedula e invia messaggi WhatsApp personalizzati ai lead" },
      { icon: "📧", text: "Schedula e invia email personalizzate ai lead" },
      { icon: "🗓️", text: "Gestisce il proprio calendario di outreach in autonomia" },
      { icon: "🧠", text: "Adatta la strategia in base ai risultati dei contatti precedenti" },
    ],
    cantDo: [
      { icon: "🤝", text: "Non gestisce lead già in trattativa — li lascia al consulente" },
      { icon: "📋", text: "Non crea reportistica avanzata — focus su prospecting e primo contatto" },
      { icon: "👥", text: "Non gestisce i clienti esistenti — si occupa solo di nuovi prospect" },
    ],
    workflow: "Ogni ciclo → Analizza Sales Context → Cerca lead su Maps/Search → Scraping siti → Qualifica con AI + panoramica azienda → Schedula chiamate/messaggi/email a calendario → Esegue l'outreach in autonomia",
  },
  architetto: {
    canDo: [
      { icon: "🏗️", text: "Genera funnel completi basati su ricerca di mercato e brand voice" },
      { icon: "🔍", text: "Analizza la brand voice e l'identità del tuo business" },
      { icon: "🎯", text: "Progetta percorsi di conversione ottimizzati per il tuo target" },
      { icon: "📊", text: "Ottimizza nodi del funnel in base ai dati di mercato" },
      { icon: "💡", text: "Suggerisce copy persuasivo basato su avatar e obiezioni" },
      { icon: "🔄", text: "Itera e raffina il funnel in base al tuo feedback" },
    ],
    cantDo: [
      { icon: "📞", text: "Non esegue campagne di marketing" },
      { icon: "👥", text: "Non gestisce clienti direttamente" },
      { icon: "💬", text: "Non invia messaggi ai clienti" },
      { icon: "📧", text: "Non invia email autonomamente" },
    ],
    workflow: "Legge Brand Voice & Ricerca di Mercato → Discovery strategica → Generazione struttura funnel → Iterazione con feedback",
  },
  personalizza: {
    canDo: [
      { icon: "⚙️", text: "Completamente configurabile con le tue istruzioni" },
      { icon: "📞", text: "Può creare task su tutti i canali (voce, email, WhatsApp)" },
      { icon: "🔍", text: "Può cercare nei Private Store dei clienti" },
      { icon: "📊", text: "Analizza consulenze, task e dati dei clienti" },
      { icon: "🧠", text: "Segue le regole che definisci tu nelle istruzioni" },
      { icon: "🔄", text: "Supporta tutte le categorie di task" },
    ],
    cantDo: [
      { icon: "❓", text: "Senza istruzioni personalizzate non sa cosa fare" },
      { icon: "🎯", text: "Non ha un focus predefinito come gli altri ruoli" },
    ],
    workflow: "Ogni 30 minuti → Legge i dati configurati → Segue le TUE istruzioni personalizzate → Crea task secondo le tue regole",
  },
};

export interface ImpactItem {
  icon: string;
  label: string;
  mode: "read" | "write";
}

export const AI_ROLE_IMPACT_MAP: Record<string, ImpactItem[]> = {
  alessia: [
    { icon: "📋", label: "Consulenze", mode: "read" },
    { icon: "📞", label: "Chiamate vocali", mode: "write" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
    { icon: "📂", label: "Documenti clienti", mode: "read" },
  ],
  millie: [
    { icon: "📨", label: "Email", mode: "write" },
    { icon: "📊", label: "CRM / Lead", mode: "read" },
    { icon: "💬", label: "WhatsApp (storico)", mode: "read" },
    { icon: "📞", label: "Chiamate (storico)", mode: "read" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
    { icon: "📂", label: "Documenti clienti", mode: "read" },
  ],
  echo: [
    { icon: "📋", label: "Consulenze", mode: "read" },
    { icon: "📧", label: "Email riepilogo", mode: "write" },
    { icon: "📂", label: "Documenti clienti", mode: "read" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
  ],
  nova: [
    { icon: "📱", label: "Calendario editoriale", mode: "read" },
    { icon: "🌐", label: "Ricerca web", mode: "read" },
    { icon: "📝", label: "Contenuti (bozze)", mode: "write" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
  ],
  stella: [
    { icon: "💬", label: "WhatsApp", mode: "write" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
  ],
  marco: [
    { icon: "📅", label: "Agenda", mode: "read" },
    { icon: "📋", label: "Task e obiettivi", mode: "read" },
    { icon: "📞", label: "Chiamate a TE", mode: "write" },
    { icon: "💬", label: "WhatsApp a TE", mode: "write" },
    { icon: "📧", label: "Email a TE", mode: "write" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
  ],
  robert: [
    { icon: "📊", label: "Piattaforma", mode: "read" },
    { icon: "👥", label: "Clienti", mode: "read" },
    { icon: "💬", label: "WhatsApp a TE", mode: "write" },
    { icon: "📧", label: "Email a TE", mode: "write" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
  ],
  hunter: [
    { icon: "🔍", label: "Google Maps/Search", mode: "read" },
    { icon: "🌐", label: "Siti web (scraping)", mode: "read" },
    { icon: "📊", label: "CRM Lead", mode: "write" },
    { icon: "📞", label: "Chiamate a lead", mode: "write" },
    { icon: "💬", label: "WhatsApp a lead", mode: "write" },
    { icon: "📧", label: "Email a lead", mode: "write" },
  ],
  architetto: [
    { icon: "🎨", label: "Brand Voice", mode: "read" },
    { icon: "🔬", label: "Ricerca mercato", mode: "read" },
    { icon: "🏗️", label: "Funnel", mode: "write" },
  ],
  personalizza: [
    { icon: "📋", label: "Dati configurati", mode: "read" },
    { icon: "⚡", label: "Azioni personalizzate", mode: "write" },
    { icon: "📚", label: "Knowledge Base", mode: "read" },
  ],
};

export const DEFAULT_SETTINGS: AutonomySettings = {
  is_active: false,
  autonomy_level: 1,
  default_mode: "manual",
  working_hours_start: "08:00",
  working_hours_end: "20:00",
  working_days: [1, 2, 3, 4, 5],
  max_daily_calls: 10,
  max_daily_emails: 20,
  max_daily_whatsapp: 30,
  max_daily_analyses: 50,
  channels_enabled: { voice: true, email: false, whatsapp: false },
  allowed_task_categories: ["outreach", "reminder", "followup"],
  custom_instructions: "",
  proactive_check_interval_minutes: 60,
  role_frequencies: {},
  role_autonomy_modes: {},
  role_working_hours: {},
  reasoning_mode: "structured",
  role_reasoning_modes: {},
  autonomy_model: "gemini-3-flash-preview",
  autonomy_thinking_level: "low",
  role_temperatures: {},
  outreach_config: {
    enabled: false,
    max_searches_per_day: 5,
    max_calls_per_day: 10,
    max_whatsapp_per_day: 15,
    max_emails_per_day: 20,
    score_threshold: 60,
    channel_priority: ["voice", "whatsapp", "email"],
    cooldown_hours: 48,
    whatsapp_config_id: "",
    voice_template_id: "",
    call_instruction_template: "",
    whatsapp_template_id: "",
    cooldown_new_hours: 24,
    cooldown_contacted_days: 5,
    cooldown_negotiation_days: 7,
    max_attempts_per_lead: 3,
    first_contact_channel: "auto",
    high_score_channel: "voice",
    communication_style: "professionale",
    custom_instructions: "",
    email_signature: "",
    opening_hook: "",
  },
};

export const EMPTY_NEW_TASK: NewTaskData = {
  ai_instruction: "",
  task_category: "analysis",
  priority: 3,
  contact_name: "",
  contact_phone: "",
  client_id: "",
  preferred_channel: "",
  tone: "",
  urgency: "normale",
  scheduled_datetime: "",
  objective: "",
  additional_context: "",
  voice_template_suggestion: "",
  language: "it",
  execution_mode: "autonomous",
};
