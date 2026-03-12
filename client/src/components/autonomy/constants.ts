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
  simone: { avatar: "", quote: "Analizzo le tue campagne Meta Ads e ti dico dove stai sprecando budget e dove scalare.", role: "Ads Strategist" },
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
  simone: {
    steps: [
      { id: "fetch_ads_data", icon: "📊", label: "Caricamento inserzioni attive", description: "Recupera tutte le inserzioni delle campagne attive con metriche complete" },
      { id: "aggregate_campaigns", icon: "📈", label: "Aggregazione campagne", description: "Calcola KPI aggregati per campagna: spesa, CTR, CPC, CPL, ROAS, frequenza" },
      { id: "detect_anomalies", icon: "⚠️", label: "Rilevamento anomalie", description: "Identifica ad fatigue (freq>4), CTR basso (<0.5%), ROAS negativo, CPL elevato" },
      { id: "find_opportunities", icon: "🚀", label: "Opportunità di scaling", description: "Trova inserzioni con ROAS alto da scalare e creatività vincenti da replicare" },
      { id: "generate_recommendations", icon: "📝", label: "Raccomandazioni", description: "Genera task con azioni specifiche: pausa, scaling, A/B test, cambio creativo" },
    ],
    direction: "Nessun contatto diretto — analisi interna e report al consulente",
    directionIcon: "🏠",
    directionColor: "text-orange-600 dark:text-orange-400",
  },
};

export type CapabilityCategory = "comunicazione" | "analisi" | "organizzazione";

export const CAPABILITY_CATEGORY_META: Record<CapabilityCategory, { label: string; icon: string }> = {
  comunicazione: { label: "Comunicazione", icon: "💬" },
  analisi: { label: "Analisi & Ricerca", icon: "🔍" },
  organizzazione: { label: "Organizzazione & Azioni", icon: "⚡" },
};

export const AI_ROLE_CAPABILITIES: Record<string, {
  canDo: Array<{ icon: string; text: string; category: CapabilityCategory }>;
  cantDo: Array<{ icon: string; text: string; category: CapabilityCategory }>;
  workflow: string;
}> = {
  alessia: {
    canDo: [
      { icon: "📊", text: "Analizza lo storico delle tue consulenze", category: "analisi" },
      { icon: "📞", text: "Crea task per chiamate vocali AI ai clienti", category: "comunicazione" },
      { icon: "🔍", text: "Cerca informazioni nei Private Store dei clienti", category: "analisi" },
      { icon: "🧠", text: "Identifica chi non senti da troppo tempo", category: "analisi" },
      { icon: "📋", text: "Prepara istruzioni dettagliate per ogni chiamata", category: "organizzazione" },
      { icon: "⏰", text: "Decide autonomamente quando serve un follow-up telefonico", category: "organizzazione" },
    ],
    cantDo: [
      { icon: "📧", text: "Non può inviare email", category: "comunicazione" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp", category: "comunicazione" },
      { icon: "📱", text: "Non può gestire i social media", category: "comunicazione" },
      { icon: "📝", text: "Non può creare riepiloghi consulenze", category: "organizzazione" },
    ],
    workflow: "Ogni 30 minuti analizza consulenze e chiamate, individua i clienti che hanno bisogno di un follow-up e crea automaticamente i task di ricontatto vocale con tutto il contesto necessario.",
  },
  millie: {
    canDo: [
      { icon: "📨", text: "Gestisce tutte le email in arrivo: clienti, lead Hunter e contatti esterni", category: "comunicazione" },
      { icon: "🔍", text: "Identifica il mittente tramite CRM, Lead Scraper e anagrafica clienti", category: "analisi" },
      { icon: "📊", text: "Arricchisce il contesto con storico WhatsApp, chiamate e interazioni cross-canale", category: "analisi" },
      { icon: "🧠", text: "Classifica email per tipo, urgenza, sentiment e intent", category: "analisi" },
      { icon: "✍️", text: "Genera risposte adattive in base al tipo di contatto e alla situazione", category: "comunicazione" },
      { icon: "📄", text: "Consulta i documenti FileSearch privati dei clienti registrati", category: "analisi" },
      { icon: "💼", text: "Usa il Profilo Commerciale dell'account per risposte accurate", category: "analisi" },
      { icon: "📈", text: "Monitora il journey email e l'engagement dei clienti", category: "analisi" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può fare chiamate vocali", category: "comunicazione" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp", category: "comunicazione" },
      { icon: "📱", text: "Non può gestire i social media", category: "comunicazione" },
    ],
    workflow: "A ogni email in arrivo identifica il mittente tra CRM, lead e clienti, arricchisce il contesto con lo storico cross-canale, analizza intent e urgency, poi genera una risposta adattiva e pianifica le azioni conseguenti.",
  },
  echo: {
    canDo: [
      { icon: "📝", text: "Genera riepiloghi strutturati delle consulenze", category: "organizzazione" },
      { icon: "🎙️", text: "Analizza trascrizioni e note delle sessioni", category: "analisi" },
      { icon: "🔍", text: "Cerca informazioni nei Private Store dei clienti", category: "analisi" },
      { icon: "📧", text: "Crea task per inviare il riepilogo al cliente via email", category: "comunicazione" },
      { icon: "📋", text: "Crea report professionali post-sessione", category: "organizzazione" },
      { icon: "🧠", text: "Prioritizza consulenze urgenti da riepilogare", category: "analisi" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può fare chiamate vocali", category: "comunicazione" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp", category: "comunicazione" },
      { icon: "📱", text: "Non può gestire i social media", category: "comunicazione" },
      { icon: "🔄", text: "Non può creare follow-up autonomi", category: "organizzazione" },
    ],
    workflow: "Ogni 30 minuti cerca le consulenze ancora prive di riepilogo, analizza note e trascrizioni delle sessioni, poi crea automaticamente il task di invio riepilogo al cliente.",
  },
  nova: {
    canDo: [
      { icon: "📱", text: "Analizza il tuo calendario editoriale", category: "analisi" },
      { icon: "💡", text: "Suggerisce idee per nuovi contenuti", category: "organizzazione" },
      { icon: "🌐", text: "Ricerca trend del settore sul web", category: "analisi" },
      { icon: "📊", text: "Monitora la frequenza delle pubblicazioni", category: "analisi" },
      { icon: "📝", text: "Propone post con hook e call-to-action", category: "comunicazione" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può contattare clienti singoli", category: "comunicazione" },
      { icon: "📧", text: "Non può inviare email ai clienti", category: "comunicazione" },
      { icon: "💬", text: "Non può mandare messaggi WhatsApp", category: "comunicazione" },
      { icon: "📤", text: "Non pubblica direttamente sui social", category: "comunicazione" },
    ],
    workflow: "Ogni 30 minuti analizza i post recenti, individua gap nel calendario editoriale e opportunità di contenuto legate ai trend di settore, poi crea i task per i nuovi post con bozza già pronta.",
  },
  stella: {
    canDo: [
      { icon: "💬", text: "Monitora tutte le conversazioni WhatsApp", category: "analisi" },
      { icon: "👤", text: "Qualifica i lead non ancora gestiti", category: "analisi" },
      { icon: "🔔", text: "Identifica messaggi senza risposta", category: "analisi" },
      { icon: "📝", text: "Prepara risposte con contesto e tono giusto", category: "comunicazione" },
      { icon: "🧠", text: "Decide chi ricontattare via WhatsApp", category: "organizzazione" },
    ],
    cantDo: [
      { icon: "📞", text: "Non può fare chiamate vocali", category: "comunicazione" },
      { icon: "📧", text: "Non può inviare email", category: "comunicazione" },
      { icon: "📱", text: "Non può gestire i social media", category: "comunicazione" },
    ],
    workflow: "Ogni 30 minuti legge tutte le conversazioni WhatsApp attive, individua i messaggi senza risposta e i nuovi lead da qualificare, poi crea i task di risposta con contesto e tono già calibrati.",
  },
  marco: {
    canDo: [
      { icon: "🔥", text: "Ti spinge a raggiungere gli obiettivi strategici, senza scuse", category: "organizzazione" },
      { icon: "🗺️", text: "Legge la roadmap e i documenti KB per tenerti sulla rotta", category: "analisi" },
      { icon: "📅", text: "Analizza l'agenda e ti chiama se non stai facendo abbastanza", category: "analisi" },
      { icon: "📞", text: "Ti chiama, ti manda WhatsApp, ti scrive email per farti muovere", category: "comunicazione" },
      { icon: "⚡", text: "Ti stressa se sei in ritardo su obiettivi o scadenze", category: "organizzazione" },
      { icon: "📊", text: "Monitora performance e carico di lavoro in tempo reale", category: "analisi" },
      { icon: "📋", text: "Prepara briefing pre-consulenza con contesto completo", category: "organizzazione" },
      { icon: "🎯", text: "Verifica che ogni azione sia allineata alla crescita dell'attività", category: "analisi" },
      { icon: "💪", text: "Tono informale e diretto — come un socio che ti parla chiaro", category: "comunicazione" },
    ],
    cantDo: [
      { icon: "📞", text: "Non contatta clienti direttamente — lavora solo su di te", category: "comunicazione" },
      { icon: "📧", text: "Non invia email ai clienti", category: "comunicazione" },
      { icon: "💬", text: "Non manda messaggi WhatsApp ai clienti", category: "comunicazione" },
    ],
    workflow: "Ogni 30 minuti legge roadmap, obiettivi, documenti KB, agenda e dati reali, valuta se stai facendo abbastanza per raggiungere i tuoi obiettivi di crescita e — se rileva un ritardo — ti chiama o ti scrive per spingerti ad agire.",
  },
  robert: {
    canDo: [
      { icon: "🎯", text: "Ti insegna a vendere i 10 pacchetti servizio della piattaforma", category: "organizzazione" },
      { icon: "💡", text: "Identifica opportunità di upsell e cross-sell tra i tuoi clienti", category: "analisi" },
      { icon: "🗣️", text: "Ti prepara con frasi killer, gestione obiezioni e tecniche di chiusura", category: "comunicazione" },
      { icon: "📊", text: "Analizza lo stato della piattaforma e suggerisce cosa vendere per primo", category: "analisi" },
      { icon: "💬", text: "Ti contatta via WhatsApp con consigli di vendita rapidi e mirati", category: "comunicazione" },
      { icon: "📧", text: "Ti manda email con strategie di vendita dettagliate", category: "comunicazione" },
      { icon: "🔥", text: "Tono diretto e provocatorio — come un coach di vendita al bar", category: "comunicazione" },
      { icon: "📋", text: "Monitora i moduli da configurare e li trasforma in opportunità di vendita", category: "analisi" },
    ],
    cantDo: [
      { icon: "📞", text: "Non contatta i clienti direttamente — lavora solo su di te", category: "comunicazione" },
      { icon: "🤝", text: "Non gestisce trattative — ti prepara per chiuderle tu", category: "organizzazione" },
      { icon: "📱", text: "Non gestisce i social media", category: "comunicazione" },
    ],
    workflow: "Ad ogni ciclo analizza lo stato della piattaforma e il profilo dei clienti attivi, individua le opportunità di vendita e upsell più concrete e ti contatta con strategie specifiche e frasi di chiusura pronte all'uso.",
  },
  hunter: {
    canDo: [
      { icon: "🔍", text: "Cerca automaticamente nuovi lead su Google Maps e Search", category: "analisi" },
      { icon: "🌐", text: "Analizza i siti web dei lead trovati con scraping AI", category: "analisi" },
      { icon: "📊", text: "Valuta e qualifica i lead con score di compatibilità e panoramica aziendale", category: "analisi" },
      { icon: "📞", text: "Schedula e avvia chiamate vocali ai lead qualificati", category: "comunicazione" },
      { icon: "💬", text: "Schedula e invia messaggi WhatsApp personalizzati ai lead", category: "comunicazione" },
      { icon: "📧", text: "Schedula e invia email personalizzate ai lead", category: "comunicazione" },
      { icon: "🗓️", text: "Gestisce il proprio calendario di outreach in autonomia", category: "organizzazione" },
      { icon: "🧠", text: "Adatta la strategia in base ai risultati dei contatti precedenti", category: "organizzazione" },
    ],
    cantDo: [
      { icon: "🤝", text: "Non gestisce lead già in trattativa — li lascia al consulente", category: "organizzazione" },
      { icon: "📋", text: "Non crea reportistica avanzata — focus su prospecting e primo contatto", category: "analisi" },
      { icon: "👥", text: "Non gestisce i clienti esistenti — si occupa solo di nuovi prospect", category: "organizzazione" },
    ],
    workflow: "Ad ogni ciclo legge il Sales Context configurato, cerca nuovi lead su Maps e Search, analizza i siti delle aziende trovate, qualifica i prospect con AI e panoramica aziendale, poi schedula ed esegue l'outreach multicanale in autonomia.",
  },
  architetto: {
    canDo: [
      { icon: "🏗️", text: "Genera funnel completi basati su ricerca di mercato e brand voice", category: "organizzazione" },
      { icon: "🔍", text: "Analizza la brand voice e l'identità del tuo business", category: "analisi" },
      { icon: "🎯", text: "Progetta percorsi di conversione ottimizzati per il tuo target", category: "organizzazione" },
      { icon: "📊", text: "Ottimizza nodi del funnel in base ai dati di mercato", category: "analisi" },
      { icon: "💡", text: "Suggerisce copy persuasivo basato su avatar e obiezioni", category: "comunicazione" },
      { icon: "🔄", text: "Itera e raffina il funnel in base al tuo feedback", category: "organizzazione" },
    ],
    cantDo: [
      { icon: "📞", text: "Non esegue campagne di marketing", category: "comunicazione" },
      { icon: "👥", text: "Non gestisce clienti direttamente", category: "comunicazione" },
      { icon: "💬", text: "Non invia messaggi ai clienti", category: "comunicazione" },
      { icon: "📧", text: "Non invia email autonomamente", category: "comunicazione" },
    ],
    workflow: "Legge il Brand Voice e la Ricerca di Mercato caricati, esegue una discovery strategica del business, genera la struttura del funnel completa di copy e poi itera sulla base del tuo feedback fino al risultato definitivo.",
  },
  personalizza: {
    canDo: [
      { icon: "⚙️", text: "Completamente configurabile con le tue istruzioni", category: "organizzazione" },
      { icon: "📞", text: "Può creare task su tutti i canali (voce, email, WhatsApp)", category: "comunicazione" },
      { icon: "🔍", text: "Può cercare nei Private Store dei clienti", category: "analisi" },
      { icon: "📊", text: "Analizza consulenze, task e dati dei clienti", category: "analisi" },
      { icon: "🧠", text: "Segue le regole che definisci tu nelle istruzioni", category: "organizzazione" },
      { icon: "🔄", text: "Supporta tutte le categorie di task", category: "organizzazione" },
    ],
    cantDo: [
      { icon: "❓", text: "Senza istruzioni personalizzate non sa cosa fare", category: "organizzazione" },
      { icon: "🎯", text: "Non ha un focus predefinito come gli altri ruoli", category: "organizzazione" },
    ],
    workflow: "Ogni 30 minuti legge i dati configurati dall'account, esegue esattamente le istruzioni personalizzate che hai scritto e crea i task secondo le regole di business che hai definito tu.",
  },
  simone: {
    canDo: [
      { icon: "📊", text: "Analizza tutte le inserzioni delle campagne attive con metriche complete", category: "analisi" },
      { icon: "⚠️", text: "Rileva anomalie: ad fatigue, CTR basso, ROAS negativo, CPL elevato", category: "analisi" },
      { icon: "🚀", text: "Identifica top performer da scalare e creatività vincenti", category: "analisi" },
      { icon: "📈", text: "Calcola KPI aggregati per campagna (spesa, CTR, CPC, CPL, ROAS)", category: "analisi" },
      { icon: "💰", text: "Analizza budget (giornaliero/lifetime) e suggerisce riallocazioni", category: "analisi" },
      { icon: "🎨", text: "Valuta le creatività (titolo, body) e suggerisce A/B test", category: "analisi" },
    ],
    cantDo: [
      { icon: "📞", text: "Non contatta i clienti direttamente", category: "comunicazione" },
      { icon: "💬", text: "Non invia messaggi WhatsApp", category: "comunicazione" },
      { icon: "📧", text: "Non invia email autonomamente", category: "comunicazione" },
      { icon: "🔧", text: "Non modifica le inserzioni su Meta — solo raccomandazioni", category: "organizzazione" },
    ],
    workflow: "Ogni 30 minuti carica tutte le inserzioni delle campagne attive con tutti i parametri (spesa, CTR, CPC, CPL, ROAS, frequenza, budget, creatività). Rileva anomalie critiche, identifica opportunità di ottimizzazione e genera raccomandazioni specifiche con azioni concrete.",
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
  simone: [
    { icon: "📊", label: "Meta Ads (inserzioni attive)", mode: "read" },
    { icon: "📈", label: "Metriche campagne", mode: "read" },
    { icon: "💰", label: "Budget e spesa", mode: "read" },
    { icon: "🎨", label: "Creatività ads", mode: "read" },
    { icon: "📝", label: "Report e raccomandazioni", mode: "write" },
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

export interface RoleExample {
  icon: string;
  title: string;
  scenario: string;
  outcome: string;
}

export const AI_ROLE_EXAMPLES: Record<string, RoleExample[]> = {
  alessia: [
    {
      icon: "📞",
      title: "Cliente silenzioso da 6 settimane",
      scenario: "Alessia ha analizzato lo storico delle consulenze e ha notato che Marco non veniva ricontattato da 45 giorni. Ha creato automaticamente un task di chiamata vocale con contesto completo: ultimo argomento trattato, obiettivi aperti e tono consigliato.",
      outcome: "Chiamata schedulata e completata — cliente ha prenotato nuova consulenza",
    },
    {
      icon: "🧠",
      title: "Briefing pre-consulenza automatico",
      scenario: "Prima di una sessione con Laura, Alessia ha letto tutte le note precedenti, individuato i 3 punti aperti dell'ultima consulenza e preparato un briefing vocale da leggere al consulente. Zero tempo speso a recuperare informazioni.",
      outcome: "Consulente arrivato preparato, sessione più efficace del solito",
    },
    {
      icon: "⏰",
      title: "Follow-up autonomo post-sessione",
      scenario: "Dopo una consulenza su un piano finanziario, Alessia ha rilevato che il cliente non aveva ricevuto un follow-up. Ha creato il task di richiamo 7 giorni dopo, senza intervento manuale.",
      outcome: "Follow-up avvenuto puntualmente, piano aggiornato",
    },
    {
      icon: "🔍",
      title: "Ricerca documento cliente al volo",
      scenario: "Durante la preparazione di una chiamata, Alessia ha cercato nel Private Store del cliente l'ultimo estratto conto e il piano di risparmio aggiornato, inserendoli nel contesto della chiamata.",
      outcome: "Chiamata partita con dati aggiornati senza aprire manualmente nessun documento",
    },
  ],
  millie: [
    {
      icon: "📨",
      title: "Risposta email in 3 minuti mentre eri in consulenza",
      scenario: "Un lead ha scritto alle 10:15 chiedendo info sul pacchetto base. Millie ha consultato il CRM, trovato una richiesta di consulenza precedente di 2 settimane fa, e risposto con un messaggio personalizzato che citava il loro settore specifico e una proposta coerente.",
      outcome: "Lead risposto in tempo reale — ha prenotato consulenza entro l'ora",
    },
    {
      icon: "🔍",
      title: "Identificato cliente VIP dal tono dell'email",
      scenario: "Un cliente storico ha scritto un'email fredda e frustrata. Millie ha analizzato il sentiment, controllato lo storico delle interazioni e classificato l'email come 'urgente + retention risk'. Ha preparato una risposta empatica con proposta di contatto diretto.",
      outcome: "Cliente richiamato entro il giorno — situazione risolta",
    },
    {
      icon: "📊",
      title: "Differenziato lead da cliente esistente",
      scenario: "Un'email arrivata da un indirizzo sconosciuto. Millie ha incrociato il nome con CRM, Lead Scraper e anagrafica clienti: era un cliente già attivo che aveva cambiato email. Ha risposto con il contesto corretto invece di trattarlo come nuovo lead.",
      outcome: "Nessun malinteso, risposta contestualizzata al rapporto già esistente",
    },
    {
      icon: "📈",
      title: "Monitoraggio silenzio clienti attivi",
      scenario: "Millie ha rilevato che 3 clienti attivi non interagivano via email da oltre 30 giorni, pur avendo campagne in corso. Ha segnalato il pattern e creato task di verifica engagement.",
      outcome: "2 clienti riattivati con email mirata, 1 ha chiesto cambio piano",
    },
  ],
  echo: [
    {
      icon: "📝",
      title: "Riepilogo consulenza inviato in autonomia",
      scenario: "Dopo una sessione con Giulia sugli obiettivi di risparmio, Echo ha letto le note della consulenza, generato un riepilogo strutturato con punti chiave, decisioni prese e prossimi passi, e creato il task di invio email al cliente.",
      outcome: "Cliente ha ricevuto riepilogo professionale entro 30 minuti dalla fine della sessione",
    },
    {
      icon: "🎙️",
      title: "Analisi trascrizione con punti d'azione",
      scenario: "Una consulenza lunga 90 minuti aveva 3 argomenti sovrapposti. Echo ha analizzato la trascrizione, separato i temi e prodotto un riepilogo per ognuno con gli impegni specifici presi dal consulente.",
      outcome: "Nessun punto dimenticato, follow-up precisi su ogni accordo",
    },
    {
      icon: "🧠",
      title: "Prioritizzazione automatica arretrato",
      scenario: "Erano presenti 8 consulenze senza riepilogo. Echo le ha ordinate per urgenza — prima quelle con decisioni finanziarie importanti pendenti — e ha processato in ordine di priorità.",
      outcome: "Arretrato smaltito con focus sulle situazioni più delicate",
    },
    {
      icon: "📋",
      title: "Report professionale per cliente corporate",
      scenario: "Una consulenza con un'azienda richiedeva documentazione formale. Echo ha adattato il formato del riepilogo al profilo corporate del cliente, con intestazione, sezioni strutturate e linguaggio formale.",
      outcome: "Documento pronto da inviare senza nessuna modifica manuale",
    },
  ],
  nova: [
    {
      icon: "📱",
      title: "Gap nel calendario editoriale rilevato",
      scenario: "Nova ha analizzato il calendario dei post e notato che c'erano 8 giorni senza contenuti pianificati. Ha identificato 3 trend di settore rilevanti e proposto altrettanti post con hook e call-to-action già scritti.",
      outcome: "Gap colmato con contenuti pertinenti, nessun buco nella pubblicazione",
    },
    {
      icon: "🌐",
      title: "Trend di settore trasformato in contenuto",
      scenario: "Nova ha trovato un articolo virale sui mercati emergenti e ha proposto un post che collegava il trend alla proposta di valore del consulente, con angolazione originale e tono coerente al brand.",
      outcome: "Post pubblicato, engagement superiore alla media settimanale",
    },
    {
      icon: "💡",
      title: "Calendario editoriale mensile suggerito",
      scenario: "Nova ha analizzato i post con più engagement degli ultimi 3 mesi, identificato i formati e gli argomenti che performano meglio, e proposto un piano editoriale per il mese successivo con frequenza e mix ottimizzati.",
      outcome: "Piano accettato con minime modifiche — 30 giorni di contenuti pianificati in 5 minuti",
    },
    {
      icon: "📊",
      title: "Alert frequenza pubblicazione",
      scenario: "Nova ha rilevato che negli ultimi 14 giorni erano stati pubblicati solo 2 post invece dei 5 pianificati. Ha inviato un alert e ricreato i contenuti mancanti come bozze pronte da pubblicare.",
      outcome: "Consulente rientrato nei ritmi di pubblicazione senza lavoro extra",
    },
  ],
  stella: [
    {
      icon: "💬",
      title: "Lead WhatsApp qualificato in tempo reale",
      scenario: "Un nuovo contatto ha scritto su WhatsApp chiedendo info generiche. Stella ha analizzato il messaggio, cercato il numero nel CRM, classificato il lead come 'alto potenziale' e preparato una risposta personalizzata con proposta di consulenza gratuita.",
      outcome: "Lead risposto in 4 minuti, consulenza prenotata il giorno dopo",
    },
    {
      icon: "🔔",
      title: "Conversazione senza risposta da 48 ore",
      scenario: "Un cliente aveva scritto un messaggio urgente venerdì sera. Stella ha rilevato che lunedì mattina era ancora senza risposta, ha alzato la priorità e creato task di risposta immediata con contesto completo.",
      outcome: "Cliente ricontattato entro l'ora, situazione gestita senza escalation",
    },
    {
      icon: "🧠",
      title: "Risposta con tono adattato alla storia del cliente",
      scenario: "Un cliente fidelizzato da 2 anni ha scritto per un problema tecnico. Stella ha recuperato lo storico della relazione e adattato il tono della risposta — informale e diretto come usato nelle conversazioni precedenti.",
      outcome: "Cliente ha apprezzato la continuità del rapporto, problema risolto senza incomprensioni",
    },
    {
      icon: "👤",
      title: "Segmentazione automatica lead WhatsApp",
      scenario: "In una settimana sono arrivati 12 messaggi WhatsApp da sconosciuti. Stella li ha classificati: 4 lead qualificati, 5 richieste generali, 3 spam. Ha preparato risposte personalizzate solo per i lead qualificati.",
      outcome: "Nessun lead perso, nessun tempo sprecato su contatti non pertinenti",
    },
  ],
  marco: [
    {
      icon: "🔥",
      title: "Richiamo obiettivi strategici non rispettati",
      scenario: "Marco ha letto la roadmap e notato che l'obiettivo di 5 nuovi clienti entro fine mese era a rischio — mancavano 10 giorni e ne erano stati acquisiti solo 2. Ha chiamato il consulente con un messaggio diretto: dati reali, cosa manca, cosa fare oggi.",
      outcome: "Consulente ha riorganizzato la settimana, 3 trattative riaperte",
    },
    {
      icon: "📅",
      title: "Alert agenda troppo leggera",
      scenario: "Guardando l'agenda della settimana, Marco ha rilevato solo 2 consulenze pianificate contro una media di 7. Ha inviato un messaggio WhatsApp urgente: 'Questa settimana sei sotto del 70%. Hai già contattato i clienti inattivi degli ultimi 30 giorni?'",
      outcome: "Consulente ha riempito 4 slot entro 2 giorni",
    },
    {
      icon: "📞",
      title: "Briefing mattutino automatico",
      scenario: "Ogni mattina, Marco analizza agenda, task aperti, obiettivi settimanali e manda un messaggio di briefing al consulente: le 3 priorità del giorno, eventuali alert, e un dato motivazionale dal confronto con la settimana precedente.",
      outcome: "Consulente inizia la giornata con focus chiaro senza dover aprire 4 strumenti diversi",
    },
    {
      icon: "⚡",
      title: "Verifica allineamento azioni-obiettivi",
      scenario: "Marco ha analizzato i task completati dell'ultima settimana e rilevato che il 60% erano attività operative, non strategiche. Ha inviato un report diretto: 'Stai gestendo, non crescendo. Dove è finita la prospecting?'",
      outcome: "Consulente ha spostato il 40% del tempo su attività ad alto impatto la settimana successiva",
    },
  ],
  robert: [
    {
      icon: "🎯",
      title: "Opportunità upsell identificata in real-time",
      scenario: "Robert ha analizzato un cliente attivo che usava solo 2 dei 10 moduli disponibili. Ha inviato un messaggio: 'Luca usa solo Academy e Consulenze. Non ha ancora attivato WhatsApp AI né Voice. Con il suo volume di clienti, potrebbe ridurre il tempo di gestione del 30%.' Con script di vendita pronto.",
      outcome: "Consulente ha presentato l'upgrade nella consulenza successiva — attivati 2 nuovi moduli",
    },
    {
      icon: "💬",
      title: "Script per gestire l'obiezione 'costa troppo'",
      scenario: "Un cliente stava per non rinnovare per motivi di costo. Robert ha inviato 3 frasi di risposta testate, un calcolo del ROI specifico per quel cliente e un'alternativa di downgrade consapevole per non perdere il cliente.",
      outcome: "Cliente ha rinnovato con piano ridotto — relazione mantenuta",
    },
    {
      icon: "📊",
      title: "Audit piattaforma settimanale",
      scenario: "Robert ha analizzato quali moduli erano configurati e quali no, e quali clienti erano sottoutilizzati. Ha prodotto una lista di 5 opportunità concrete ordinate per probabilità di chiusura, con approccio consigliato per ognuna.",
      outcome: "Consulente ha una pipeline di upsell chiara senza dover analizzare i dati da solo",
    },
    {
      icon: "🔥",
      title: "Coaching pre-consulenza di vendita",
      scenario: "Prima di un incontro con un cliente interessato al piano Premium, Robert ha inviato un mini-briefing: i 3 punti di forza da evidenziare, le obiezioni probabili con le contro-risposte, e il momento giusto per chiedere la firma.",
      outcome: "Consulente è arrivato preparato — contratto chiuso al primo incontro",
    },
  ],
  hunter: [
    {
      icon: "🔍",
      title: "12 lead trovati su Google Maps in un ciclo",
      scenario: "Hunter ha analizzato il Sales Context (target: liberi professionisti nel nord Italia), cercato su Google Maps 'commercialisti Milano', trovato 12 studi non ancora nel CRM, analizzato i loro siti web con scraping AI e assegnato un punteggio di compatibilità a ognuno.",
      outcome: "12 lead qualificati pronti per outreach, top 5 schedulati per chiamata entro 24 ore",
    },
    {
      icon: "📞",
      title: "Outreach multicanale orchestrato",
      scenario: "Per i 5 lead top, Hunter ha schedulato: prima una chiamata vocale AI, poi — in caso di non risposta dopo 48 ore — un messaggio WhatsApp, poi un'email. Tutto coordinato automaticamente senza intervento manuale.",
      outcome: "3 su 5 lead hanno risposto, 2 hanno accettato una demo",
    },
    {
      icon: "🧠",
      title: "Adattamento strategia da risultati precedenti",
      scenario: "Hunter ha analizzato i risultati dei 30 giorni precedenti: le email aveva un tasso di apertura del 12%, le chiamate vocali del 34%. Ha spostato autonomamente il budget di contatto verso le chiamate per il ciclo successivo.",
      outcome: "Tasso di risposta aumentato del 22% nel ciclo successivo",
    },
    {
      icon: "🌐",
      title: "Panoramica aziendale da sito web",
      scenario: "Per ogni lead trovato, Hunter ha analizzato il sito web dell'azienda: servizi offerti, dimensioni, tono comunicativo. Ha usato queste informazioni per personalizzare il primo messaggio di contatto con riferimenti specifici all'attività.",
      outcome: "Tasso di risposta ai messaggi personalizzati 3x rispetto ai messaggi generici",
    },
  ],
  architetto: [
    {
      icon: "🏗️",
      title: "Funnel completo generato da zero",
      scenario: "Architetto ha letto il Brand Voice del consulente e la ricerca di mercato caricata. Ha identificato il target ideale, progettato un funnel in 5 fasi (awareness → interesse → considerazione → decisione → onboarding) con copy per ogni step.",
      outcome: "Funnel pronto da implementare, con copy persuasivo già adattato al brand",
    },
    {
      icon: "🔍",
      title: "Analisi brand voice e identità",
      scenario: "Architetto ha analizzato i contenuti social, le email e i documenti del consulente per estrarre il tono di voce dominante, i valori impliciti e i punti di differenziazione rispetto ai competitor. Ha prodotto un profilo brand completo.",
      outcome: "Consulente ha un documento di Brand Voice da condividere con collaboratori e fornitori",
    },
    {
      icon: "🎯",
      title: "Ottimizzazione nodo critico del funnel",
      scenario: "Il tasso di conversione da 'interesse' a 'consulenza prenotata' era del 8%. Architetto ha analizzato il nodo critico, identificato 3 possibili cause (CTA debole, troppo testo, mancanza di social proof) e proposto A/B test con varianti specifiche.",
      outcome: "Conversione salita al 14% con la variante consigliata",
    },
    {
      icon: "💡",
      title: "Copy per avatar specifico",
      scenario: "Il consulente aveva un cliente-tipo ben definito: imprenditore 40-55 anni, preoccupato per la pensione. Architetto ha scritto copy per ogni step del funnel parlando direttamente a quell'avatar, con obiezioni tipiche già gestite nel testo.",
      outcome: "Contenuti risonano molto di più con il target — richieste di consulenza aumentate",
    },
  ],
  simone: [
    {
      icon: "⚠️",
      title: "Ad fatigue rilevata su campagna principale",
      scenario: "Simone ha analizzato le inserzioni attive e ha notato che 3 ads della campagna 'Lead Gen Maggio' avevano frequenza superiore a 5.2. Ha creato un task con raccomandazione specifica: mettere in pausa le 3 inserzioni e sostituire con nuove creatività.",
      outcome: "Creatività sostituite, frequenza tornata a 2.1, CTR risalito del 40%",
    },
    {
      icon: "🚀",
      title: "Opportunità di scaling individuata",
      scenario: "Un'inserzione aveva ROAS 4.2x con budget giornaliero di soli €15. Simone ha segnalato l'opportunità di scaling con aumento graduale del budget (+20% ogni 3 giorni) e ha suggerito di replicare l'angolo creativo su nuovi adset.",
      outcome: "Budget triplicato mantenendo ROAS > 3x, lead raddoppiati",
    },
    {
      icon: "💰",
      title: "Spreco di budget bloccato in tempo",
      scenario: "Una campagna con 5 inserzioni spendeva €120/giorno con ROAS 0.3x. Simone ha identificato che solo 1 inserzione su 5 aveva risultati accettabili e ha raccomandato di pausare le altre 4 immediatamente.",
      outcome: "€96/giorno risparmiati, budget riallocato su inserzioni performanti",
    },
    {
      icon: "📊",
      title: "Report settimanale con trend e anomalie",
      scenario: "Nessuna anomalia critica, ma Simone ha generato un report riepilogativo con: CPL medio per campagna, trend settimanale, confronto tra adset, e 3 suggerimenti di ottimizzazione basati sui dati (A/B test creatività, test nuovo pubblico, aumento budget top performer).",
      outcome: "Consulente ha preso decisioni informate in 2 minuti invece di analizzare i dati manualmente",
    },
  ],
  personalizza: [
    {
      icon: "⚙️",
      title: "Agente configurato per monitoraggio specifico",
      scenario: "Il consulente ha definito istruzioni personalizzate: 'Ogni ciclo, controlla se ci sono clienti con appuntamento domani che non hanno completato il questionario pre-consulenza. Se li trovi, crea un task WhatsApp di reminder.' L'agente ha iniziato a farlo autonomamente.",
      outcome: "100% dei clienti arriva alla consulenza con questionario compilato",
    },
    {
      icon: "🔄",
      title: "Workflow personalizzato multi-step",
      scenario: "Istruzioni: 'Dopo ogni consulenza completata, crea: 1) un task Echo per il riepilogo, 2) un task Alessia per il follow-up vocale a 7 giorni, 3) un promemoria nella KB del cliente con i punti chiave'. L'agente esegue la sequenza completa ad ogni ciclo.",
      outcome: "Workflow post-consulenza sempre eseguito, zero step dimenticati",
    },
    {
      icon: "📊",
      title: "Report personalizzato settimanale",
      scenario: "L'agente è stato configurato per generare ogni lunedì un report personalizzato: clienti senza contatto da 2+ settimane, task aperti oltre scadenza, e obiettivi del mese con percentuale di avanzamento. Format: email al consulente.",
      outcome: "Consulente inizia ogni settimana con una foto chiara della situazione",
    },
    {
      icon: "🧠",
      title: "Regole di business personalizzate",
      scenario: "Istruzioni: 'Mai creare task di chiamata vocale per clienti con tag 'no-disturb'. Per i clienti premium, usa sempre tono formale. Per i nuovi lead, crea sempre un task di qualifica prima di qualsiasi contatto.' L'agente rispetta queste regole ad ogni ciclo.",
      outcome: "Comportamento dell'agente perfettamente allineato alle preferenze del consulente",
    },
  ],
};
