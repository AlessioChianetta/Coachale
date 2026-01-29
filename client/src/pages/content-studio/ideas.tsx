import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Lightbulb,
  Sparkles,
  Star,
  FileText,
  Zap,
  Loader2,
  Trash2,
  AlertCircle,
  Calendar,
  ImageIcon,
  Bookmark,
  BookmarkCheck,
  ArrowUpDown,
  HelpCircle,
  Hash,
  MessageCircleQuestion,
  Wrench,
  TrendingUp,
  Target,
  Cog,
  Rocket,
  Crown,
  Eye,
  Heart,
  UserPlus,
  ShoppingCart,
  GraduationCap,
  Award,
  Brain,
  AlertTriangle,
  Compass,
  Package,
  Gift,
  Check,
  Save,
  FolderOpen,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  Video,
  Camera,
  FileText as FileTextIcon,
  AlignLeft,
  CheckCircle,
  CheckCircle2,
  Clock,
  Archive,
  ExternalLink,
  PlayCircle,
  Wand2,
  Building2,
  Download,
  Instagram,
  Twitter,
  Linkedin,
  Megaphone,
  BookOpen,
  Users,
  Type,
  Palette,
  Scissors,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { motion } from "framer-motion";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { useLocation } from "wouter";
import { Switch } from "@/components/ui/switch";
import { BrandVoiceSection, BrandVoiceData, KnowledgeBaseSelector, TempFile } from "@/components/brand-voice";

interface Idea {
  id: string;
  title: string;
  description: string;
  score: number;
  hook: string;
  contentType: string;
  targetAudience: string;
  status: "new" | "in_progress" | "developed" | "archived";
  createdAt: string;
  isSaved?: boolean;
  mediaType?: "video" | "photo";
  copyType?: "short" | "long";
  videoScript?: string;
  imageDescription?: string;
  imageOverlayText?: string;
  copyContent?: string;
  developedPostId?: string;
  lengthWarning?: string;
  targetPlatform?: "instagram" | "x" | "linkedin";
  postCategory?: "ads" | "valore" | "formazione" | "altri";
  postSchema?: string;
  schemaStructure?: string;
}

type IdeaStatus = "new" | "in_progress" | "developed" | "archived";

const STATUS_FILTERS = [
  { value: "all", label: "Tutte", icon: Lightbulb },
  { value: "new", label: "Nuove", icon: Sparkles },
  { value: "in_progress", label: "In Lavorazione", icon: Clock },
  { value: "developed", label: "Sviluppate", icon: CheckCircle },
  { value: "archived", label: "Archiviate", icon: Archive },
] as const;

function getStatusInfo(status: IdeaStatus, developedPostId?: string) {
  if (developedPostId || status === "developed") {
    return { 
      label: "Sviluppata", 
      color: "bg-green-500/10 text-green-600 border-green-200 dark:border-green-800", 
      icon: CheckCircle,
      cardClass: "border-l-4 border-l-green-500"
    };
  }
  switch (status) {
    case "in_progress":
      return { 
        label: "In Lavorazione", 
        color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800", 
        icon: Clock,
        cardClass: "border-l-4 border-l-amber-500"
      };
    case "archived":
      return { 
        label: "Archiviata", 
        color: "bg-gray-500/10 text-gray-500 border-gray-200 dark:border-gray-700", 
        icon: Archive,
        cardClass: "border-l-4 border-l-gray-400 opacity-75"
      };
    default:
      return { 
        label: "Nuova", 
        color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800", 
        icon: Sparkles,
        cardClass: ""
      };
  }
}

const OBJECTIVES = [
  { value: "awareness", label: "Brand Awareness", description: "Fai conoscere il tuo brand a nuove persone", icon: Eye },
  { value: "engagement", label: "Engagement", description: "Aumenta like, commenti e interazioni", icon: Heart },
  { value: "leads", label: "Lead Generation", description: "Raccogli contatti e richieste", icon: UserPlus },
  { value: "sales", label: "Vendite", description: "Converti il pubblico in clienti", icon: ShoppingCart },
  { value: "education", label: "Educazione", description: "Insegna e condividi valore", icon: GraduationCap },
  { value: "authority", label: "Autorità", description: "Posizionati come esperto del settore", icon: Award },
];

const AWARENESS_LEVELS = [
  { value: "unaware", label: "Non Consapevole", description: "Non sa di avere un problema", icon: Brain, color: "red" },
  { value: "problem_aware", label: "Consapevole Problema", description: "Sente disagio ma non conosce soluzioni", icon: AlertTriangle, color: "orange" },
  { value: "solution_aware", label: "Consapevole Soluzione", description: "Conosce soluzioni ma non la tua", icon: Compass, color: "yellow" },
  { value: "product_aware", label: "Consapevole Prodotto", description: "Conosce il tuo prodotto ma non è convinto", icon: Package, color: "blue" },
  { value: "most_aware", label: "Più Consapevole", description: "Desidera il prodotto, aspetta l'offerta giusta", icon: Gift, color: "green" },
];

const SOPHISTICATION_LEVELS = [
  { value: "level_1", label: "Livello 1 - Beneficio Diretto", description: "Primo sul mercato, claim semplice", icon: Target, color: "emerald" },
  { value: "level_2", label: "Livello 2 - Amplifica Promessa", description: "Secondo sul mercato, prove concrete", icon: TrendingUp, color: "blue" },
  { value: "level_3", label: "Livello 3 - Meccanismo Unico", description: "Mercato saturo, differenziati", icon: Cog, color: "purple" },
  { value: "level_4", label: "Livello 4 - Meccanismo Migliorato", description: "Concorrenza attiva, specializzati", icon: Rocket, color: "orange" },
  { value: "level_5", label: "Livello 5 - Identità e Brand", description: "Mercato scettico, connessione emotiva", icon: Crown, color: "pink" },
];

const TARGET_PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: Instagram, color: "bg-gradient-to-br from-purple-500 to-pink-500", charLimit: 2200 },
  { value: "x", label: "X (Twitter)", icon: Twitter, color: "bg-black", charLimit: 280 },
  { value: "linkedin", label: "LinkedIn", icon: Linkedin, color: "bg-blue-700", charLimit: 3000 },
] as const;

const POST_CATEGORIES = [
  { value: "ads", label: "Inserzioni (Ads)", description: "Contenuti sponsorizzati per conversioni", icon: Megaphone },
  { value: "valore", label: "Post di Valore", description: "Contenuti educativi e informativi", icon: BookOpen },
  { value: "formazione", label: "Formazione", description: "Corsi, tutorial e contenuti educativi", icon: GraduationCap },
  { value: "altri", label: "Altri Post", description: "Community, relazione, engagement", icon: Users },
] as const;

const PLATFORM_LIMITS = {
  instagram: { caption: 2200, hashtags: 30, description: "Caption max 2.200 caratteri" },
  x: { tweet: 280, thread: 25000, description: "Tweet max 280 caratteri" },
  linkedin: { post: 3000, article: 125000, description: "Post max 3.000 caratteri" },
} as const;

const WRITING_STYLES = [
  { 
    value: "default", 
    label: "Predefinito", 
    description: "Professionale e bilanciato, tono naturale",
    icon: "📝"
  },
  { 
    value: "conversational", 
    label: "Conversazionale (Nurturing)", 
    description: "Frasi brevi, riga per riga, storytelling personale, pattern interrupt",
    icon: "💬"
  },
  { 
    value: "direct", 
    label: "Diretto", 
    description: "Conciso, va dritto al punto, no fronzoli",
    icon: "🎯"
  },
  { 
    value: "persuasive", 
    label: "Copy Persuasivo", 
    description: "Tecnico copywriting, trigger emotivi, urgenza",
    icon: "🔥"
  },
  { 
    value: "custom", 
    label: "Personalizzato", 
    description: "Definisci le tue istruzioni di stile",
    icon: "✏️"
  },
] as const;

const POST_SCHEMAS: Record<string, Record<string, Array<{ value: string; label: string; structure: string; description: string }>>> = {
  instagram: {
    ads: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni: aggancia, posizionamento, problema, soluzione, prova sociale, azione" },
      { value: "hook_problema_nuovo", label: "Hook → Problema → Nuovo modo → Prova → CTA", structure: "Hook|Problema|Nuovo modo|Prova sociale|Offerta|CTA", description: "Per Reels/Stories: aggancia, mostra frizione, presenta meccanismo" },
      { value: "before_after_bridge", label: "Before → After → Bridge → CTA", structure: "Prima|Dopo|Ponte (processo)|CTA", description: "Ottimo per creativi visual con trasformazione" },
      { value: "pain_benefit_offer", label: "3 Pain → 3 Benefit → Offer → Urgenza → CTA", structure: "Pain 1|Pain 2|Pain 3|Benefit 1|Benefit 2|Benefit 3|Offerta|Urgenza|CTA", description: "Perfetto per performance con elenco scorrevole" },
      { value: "obiezione_confutazione", label: "Obiezione → Confutazione → Demo → CTA", structure: "Obiezione forte|Confutazione|Mini-dimostrazione|CTA", description: "Funziona quando il mercato è scettico" },
      { value: "ugc_founder", label: "UGC/Founder Script (15-30s)", structure: "Chi sono|Cosa odiavo|Cosa ho cambiato|Risultato|Come farlo|CTA", description: "Nativo, credibile, ottimo CPC/CPA" },
    ],
    valore: [
      { value: "carousel_errore", label: "Carousel Errore → Perché → Cosa fare → Esempio", structure: "Errore #1|Perché succede|Cosa fare|Esempio|Checklist|CTA soft", description: "Altissima retention: ogni slide una micro-promessa" },
      { value: "framework_5step", label: "Framework in 5 Step", structure: "Hook|Contesto|Step 1|Step 2|Step 3|Step 4|Step 5|Caso reale|CTA", description: "Trasferisce metodo, non solo tips" },
      { value: "teardown_analisi", label: "Teardown / Analisi", structure: "Hook|Cosa analizziamo|3 cose fatte bene|3 da migliorare|Template|CTA", description: "Autorità immediata, salva/condivisioni" },
      { value: "myth_busting", label: "Myth Busting", structure: "Mito|Perché è falso|La regola vera|Come applicarla|CTA", description: "Ottimo per differenziarti" },
      { value: "case_study", label: "Case Study", structure: "Risultato|Punto di partenza|Azioni|Ostacolo|Soluzione|Lezione|CTA", description: "Prova sociale senza vantarsi" },
    ],
    formazione: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni: aggancia, posizionamento, problema, soluzione, prova sociale, azione" },
      { value: "tutorial_step", label: "Tutorial Step-by-Step", structure: "Hook|Obiettivo|Step 1|Step 2|Step 3|Step 4|Step 5|Risultato|CTA", description: "Guida pratica passo-passo per imparare qualcosa" },
      { value: "lezione_concetto", label: "Lezione: Concetto → Applicazione", structure: "Hook|Concetto chiave|Perché importante|Esempio 1|Esempio 2|Come applicarlo|Errore comune|CTA", description: "Insegna un concetto con esempi pratici" },
      { value: "corso_teaser", label: "Teaser Corso/Modulo", structure: "Hook|Cosa imparerai|Modulo 1|Modulo 2|Modulo 3|Per chi è|Risultato atteso|CTA", description: "Presenta un corso o modulo formativo" },
      { value: "esercizio_pratico", label: "Esercizio Pratico", structure: "Hook|Obiettivo esercizio|Materiali|Istruzioni|Errori da evitare|Risultato atteso|CTA", description: "Propone un esercizio da fare" },
      { value: "quiz_verifica", label: "Quiz/Verifica Apprendimento", structure: "Hook|Domanda 1|Domanda 2|Domanda 3|Risposte|Spiegazione|CTA", description: "Testa le conoscenze del pubblico" },
    ],
    altri: [
      { value: "pov_domanda", label: "POV + Domanda", structure: "Opinione forte|Motivo 1|Motivo 2|Domanda", description: "Genera commenti e discussione" },
      { value: "behind_scenes", label: "Behind the Scenes", structure: "Cosa stai facendo|Perché|Cosa hai imparato|CTA", description: "Umano, fidelizza" },
      { value: "story_fallimento", label: "Story: Fallimento → Lezione → Regola", structure: "Errore|Costo|Cosa hai cambiato|Regola", description: "Connessione + autorevolezza" },
    ],
  },
  x: {
    ads: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni: aggancia, posizionamento, problema, soluzione, prova sociale, azione" },
      { value: "oneliner_proof", label: "One-liner Value → Proof → CTA", structure: "Promessa (1 riga)|Prova (numero/risultato)|CTA", description: "Su X vince la chiarezza + credibilità" },
      { value: "pas_ultracompatto", label: "PAS Ultracompatto", structure: "Problema|Agitazione (1 riga)|Soluzione|CTA", description: "Per awareness e lead magnet" },
      { value: "contrarian_payoff", label: "Contrarian + Payoff", structure: "Hot take|Perché|Cosa fare invece|CTA", description: "Alta attenzione, CTR" },
      { value: "offer_first", label: "Offer-first", structure: "Offerta|Chi è per|Cosa ottieni|Vincolo/urgenza|CTA", description: "Funziona per conversioni dirette" },
    ],
    valore: [
      { value: "thread_manuale", label: "Thread Manuale Operativo", structure: "Hook tweet|Step 1|Step 2|Step 3|Step 4|Step 5|Esempio|Recap|CTA", description: "Thread salva/riporta follower" },
      { value: "checklist", label: "Checklist", structure: "Titolo|Punto 1|Punto 2|Punto 3|Punto 4|Punto 5|Punto 6|Punto 7|CTA", description: "Facile da consumare e salvare" },
      { value: "principio_caso_regola", label: "Principio → Caso → Regola", structure: "Principio|Mini-storia|Regola applicabile", description: "Authority senza lunghezza" },
      { value: "mini_playbook", label: "Mini-playbook", structure: "Obiettivo|Leva 1|Leva 2|Leva 3|Errore 1|Errore 2|Errore 3|Template", description: "Altissimo valore percepito" },
      { value: "swipe_template", label: "Swipe/Template Tweet", structure: "Copia-incolla:|Template|Quando usarlo", description: "Condivisioni elevate" },
    ],
    formazione: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni" },
      { value: "thread_tutorial", label: "Thread Tutorial", structure: "Hook tweet|Obiettivo|Step 1|Step 2|Step 3|Step 4|Step 5|Recap|CTA", description: "Thread formativo passo-passo" },
      { value: "lezione_rapida", label: "Lezione Rapida (280 char)", structure: "Concetto|Perché|Come applicarlo|CTA", description: "Micro-lezione in un tweet" },
      { value: "tip_giornaliero", label: "Tip Giornaliero", structure: "Tip|Esempio|Azione immediata", description: "Pillola formativa quotidiana" },
      { value: "errore_correzione", label: "Errore → Correzione", structure: "Errore comune|Perché sbagliato|Come farlo bene|CTA", description: "Corregge un errore frequente" },
    ],
    altri: [
      { value: "build_public", label: "Build in Public", structure: "Cosa hai fatto oggi|Cosa hai imparato|Prossima mossa", description: "Community e consistenza" },
      { value: "qa_prompt", label: "Q&A Prompt", structure: "Rispondo a domande su X...", description: "Genera conversazioni e contenuti futuri" },
    ],
  },
  linkedin: {
    ads: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni: aggancia, posizionamento, problema, soluzione, prova sociale, azione" },
      { value: "problema_ruolo", label: "Problema di Ruolo → Costo → Soluzione → Prova → CTA", structure: "Se sei [ruolo]...|Problema|Costo|Soluzione|Proof|CTA", description: "LinkedIn richiede targeting per job-to-be-done" },
      { value: "case_study_ad", label: "Case Study Ad", structure: "Risultato|In quanto tempo|Cosa abbiamo cambiato|1 grafico/numero|CTA", description: "Best performer per B2B" },
      { value: "lead_magnet_ad", label: "Lead Magnet Ad", structure: "Titolo asset|Bullet 1|Bullet 2|Bullet 3|Per chi|CTA", description: "Ottimo CPL, semplice da validare" },
      { value: "obiezione_demo", label: "Obiezione → Risposta → Demo-invito", structure: "Non funziona se...|Condizione vera|Come lo rendiamo vero|CTA demo", description: "Riduce attrito sui lead" },
    ],
    valore: [
      { value: "story_professionale", label: "Story Professionale", structure: "Situazione|Tensione|Decisione|Risultato|Lezione|CTA", description: "LinkedIn ama narrazione + insight" },
      { value: "carosello_pdf", label: "Carosello Documento (PDF)", structure: "Titolo|Problema|Framework|Esempi|Checklist|CTA", description: "Altissima permanenza e salvataggi" },
      { value: "post_insegnamento", label: "Post Insegnamento", structure: "Claim|Perché|Esempio 1|Esempio 2|Esempio 3|Azione 1|Azione 2|Azione 3|CTA", description: "Autorità + praticità" },
      { value: "teardown_b2b", label: "Teardown B2B", structure: "Cosa analizziamo|3 punti forti|3 errori|Come rifarlo|CTA", description: "Posizionamento immediato" },
      { value: "opinion_dati", label: "Opinion + Dati", structure: "Tesi|Dato/prova|Implicazione|Cosa fare|CTA", description: "Perfetto per consulenza/servizi" },
    ],
    formazione: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni" },
      { value: "post_educativo", label: "Post Educativo Professionale", structure: "Hook|Contesto professionale|Concetto chiave|3 Punti pratici|Esempio reale|Takeaway|CTA", description: "Formato long-form educativo per LinkedIn" },
      { value: "carosello_corso", label: "Carosello Formativo (PDF)", structure: "Titolo corso/modulo|Obiettivo|Lezione 1|Lezione 2|Lezione 3|Esercizio|CTA", description: "Carosello PDF con contenuto formativo" },
      { value: "case_study_formativo", label: "Case Study Formativo", structure: "Situazione iniziale|Sfida formativa|Metodo usato|Risultati|Lezioni apprese|CTA", description: "Racconta un percorso di formazione" },
      { value: "framework_educativo", label: "Framework Educativo", structure: "Hook|Nome framework|Componente 1|Componente 2|Componente 3|Come applicarlo|CTA", description: "Presenta un framework di apprendimento" },
    ],
    altri: [],
  },
};

const SECTION_GUIDELINES_DISPLAY: Record<string, string> = {
  "hook": "Cattura l'attenzione nei primi 3 secondi. Usa domanda provocatoria, statistica sorprendente, o affermazione controintuitiva.",
  "hot_take": "Afferma qualcosa che va contro il pensiero comune. Deve far pensare 'Non sono d'accordo!' o 'Finalmente qualcuno lo dice!'",
  "opinione": "Esprimi un punto di vista deciso e potenzialmente controverso. Prendi posizione netta.",
  "mito": "Presenta una credenza comune nel settore che in realtà è falsa o limitante.",
  "pain": "Descrivi il problema specifico che il target vive. Usa dettagli concreti e emozioni negative.",
  "problema": "Esponi il problema centrale con esempi reali e conseguenze tangibili.",
  "errore": "Mostra l'errore comune che il target commette senza saperlo.",
  "costo": "Quantifica il costo del problema: tempo perso, soldi bruciati, opportunità mancate.",
  "agitazione": "Amplifica il dolore: cosa perdono se non agiscono? Cosa rischiano?",
  "obiezione": "Presenta l'obiezione più comune del target, formulata come la penserebbe lui.",
  "cosa_odiavo": "Racconta cosa ti frustrava prima di trovare la soluzione. Sii autentico.",
  "prima": "Dipingi la situazione attuale del target: problemi, frustrazioni, cosa non funziona.",
  "punto_di_partenza": "Descrivi da dove è partito il cliente: situazione iniziale, sfide, limiti.",
  "situazione": "Presenta il contesto iniziale: chi, dove, quando, cosa stava succedendo.",
  "contesto": "Fornisci il background necessario per capire il resto.",
  "dopo": "Mostra il risultato ideale: come si sente, cosa fa di diverso, quali risultati ottiene.",
  "risultato": "Presenta i risultati concreti: numeri specifici, trasformazioni misurabili.",
  "benefit": "Presenta un vantaggio specifico e misurabile. Descrivi l'impatto concreto.",
  "soluzione": "Spiega come si risolve il problema. Rendi il processo credibile e raggiungibile.",
  "ponte": "Collega il 'prima' al 'dopo'. Spiega il meccanismo della trasformazione.",
  "nuovo_modo": "Presenta l'approccio alternativo. Differenzialo dai metodi tradizionali.",
  "cosa_fare": "Dai indicazioni pratiche e actionable su cosa fare concretamente.",
  "confutazione": "Smonta l'obiezione con logica, prove concrete, esempi reali.",
  "perche_falso": "Spiega perché il mito è sbagliato con fatti, dati o ragionamento.",
  "regola_vera": "Presenta la verità che sostituisce il mito. Rendila memorabile.",
  "cosa_ho_cambiato": "Descrivi il cambiamento specifico: azione, mentalità, processo.",
  "come_farlo": "Spiega i passaggi pratici per replicare il risultato.",
  "chi_cosa_come": "Spiega chi sei, cosa fai e come lo fai in modo unico.",
  "chi_sono": "Presentati in modo autentico: chi sei, cosa fai, perché sei credibile.",
  "riprova_sociale": "Inserisci prove di credibilità: numeri, risultati, testimonianze.",
  "prova": "Fornisci prove concrete: numeri, case study, testimonianze verificabili.",
  "dimostrazione": "Mostra che funziona: esempio pratico, prima/dopo, demo del risultato.",
  "esempio": "Illustra con un esempio concreto e specifico.",
  "caso_reale": "Racconta un caso reale: cliente, problema, processo, risultato.",
  "step": "Descrivi questo passaggio in modo chiaro e actionable.",
  "leva": "Presenta una leva strategica chiave. Spiega cosa è e perché funziona.",
  "azioni": "Elenca le azioni concrete intraprese. Sii specifico.",
  "ostacolo": "Presenta l'ostacolo incontrato: cosa ha reso difficile il percorso.",
  "tensione": "Crea tensione narrativa: il momento critico, la sfida da superare.",
  "decisione": "Racconta la scelta cruciale fatta. Cosa hai deciso e perché.",
  "lezione": "Condividi l'insight chiave appreso. Rendilo memorabile e applicabile.",
  "regola": "Formula una regola chiara e memorabile che il lettore può applicare.",
  "cosa_ho_imparato": "Condividi l'apprendimento più importante. Sii genuino.",
  "principio": "Enuncia un principio universale o una verità del tuo campo.",
  "claim": "Fai un'affermazione forte e difendibile. Prendi posizione.",
  "offerta": "Presenta cosa offri in modo chiaro. Sottolinea il valore unico.",
  "cosa_ottieni": "Elenca i benefici concreti che il cliente riceve.",
  "per_chi": "Specifica chi è il cliente ideale. Aiuta a pre-qualificare.",
  "bullet": "Presenta un beneficio chiave in modo conciso e d'impatto.",
  "titolo_asset": "Scrivi il titolo del lead magnet/risorsa in modo attraente.",
  "urgenza": "Crea scarsità legittima: posti limitati, deadline, bonus temporanei.",
  "vincolo": "Presenta il limite: tempo, quantità, condizioni.",
  "cta": "Invito all'azione chiaro e diretto. Dì cosa fare e cosa succede dopo.",
  "cta_soft": "CTA morbida: invita a salvare, commentare, o riflettere.",
  "domanda": "Poni una domanda che invita alla risposta/commento. Genera engagement.",
  "cosa_analizziamo": "Presenta cosa stai analizzando e perché è rilevante.",
  "cose_fatte_bene": "Evidenzia gli aspetti positivi con specifiche.",
  "da_migliorare": "Indica le aree di miglioramento con suggerimenti pratici.",
  "punti_forti": "Elenca i punti di forza con esempi specifici.",
  "template": "Fornisci un template pronto all'uso che il lettore può copiare.",
  "checklist": "Elenca i punti da verificare in modo chiaro e sequenziale.",
  "punto": "Presenta un item della lista in modo chiaro e actionable.",
  "recap": "Riassumi i punti chiave in modo memorabile.",
  "cosa_hai_fatto": "Racconta cosa hai fatto oggi/di recente. Sii autentico.",
  "prossima_mossa": "Condividi il prossimo step. Crea aspettativa.",
  "cosa_stai_facendo": "Descrivi l'attività in corso. Porta il lettore nel tuo processo.",
  "perche": "Spiega la motivazione dietro la scelta o l'azione.",
  "motivo": "Presenta un argomento a supporto della tua tesi.",
  "mini_storia": "Racconta una breve storia esemplificativa.",
  "grafico_numero": "Presenta un dato numerico impattante.",
  "condizione_vera": "Specifica quando/come la soluzione funziona davvero.",
  "promessa": "Fai una promessa chiara e specifica. Cosa otterrà il lettore?",
  "titolo": "Scrivi un titolo chiaro che prometta valore immediato.",
  "framework": "Presenta il framework o metodo in modo strutturato.",
  "applicazione": "Spiega come applicare concretamente il concetto.",
  "quando_usarlo": "Specifica in quali situazioni usare questo template/metodo.",
  "obiettivo": "Definisci chiaramente l'obiettivo da raggiungere."
};

function getSectionGuidelineDisplay(sectionLabel: string): string {
  const normalizedLabel = sectionLabel.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .replace(/\d+/g, '');
  
  const searchTerms = [normalizedLabel, ...normalizedLabel.split('_').filter(s => s.length > 2)];
  
  for (const term of searchTerms) {
    if (SECTION_GUIDELINES_DISPLAY[term]) {
      return SECTION_GUIDELINES_DISPLAY[term];
    }
  }
  
  for (const key of Object.keys(SECTION_GUIDELINES_DISPLAY)) {
    for (const term of searchTerms) {
      if (key.includes(term) || term.includes(key)) {
        return SECTION_GUIDELINES_DISPLAY[key];
      }
    }
  }
  
  return "Sviluppa questa sezione in modo chiaro e coinvolgente.";
}

type HookType = "how-to" | "curiosità" | "numero" | "problema";

function getHookType(hook: string): HookType {
  if (!hook) return "problema";
  const lowerHook = hook.toLowerCase();
  if (lowerHook.includes("come ") || lowerHook.includes("come?")) return "how-to";
  if (lowerHook.includes("?")) return "curiosità";
  if (/\d+/.test(hook)) return "numero";
  return "problema";
}

function getHookTypeInfo(hookType: HookType) {
  switch (hookType) {
    case "how-to":
      return { label: "How-to", icon: Wrench, color: "bg-blue-500/10 text-blue-600" };
    case "curiosità":
      return { label: "Curiosità", icon: MessageCircleQuestion, color: "bg-purple-500/10 text-purple-600" };
    case "numero":
      return { label: "Numero", icon: Hash, color: "bg-orange-500/10 text-orange-600" };
    default:
      return { label: "Problema", icon: HelpCircle, color: "bg-slate-500/10 text-slate-600" };
  }
}

function getPotential(score: number): { label: string; color: string } {
  if (score >= 85) return { label: "Alto", color: "bg-green-500/10 text-green-600" };
  if (score >= 70) return { label: "Medio", color: "bg-amber-500/10 text-amber-600" };
  return { label: "Basso", color: "bg-red-500/10 text-red-600" };
}

function getScoreProgressColor(score: number): string {
  if (score >= 85) return "bg-green-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-red-500";
}

export default function ContentStudioIdeas() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [objective, setObjective] = useState("");
  const [ideaCount, setIdeaCount] = useState(3);
  const [awarenessLevel, setAwarenessLevel] = useState<"unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware">("problem_aware");
  const [sophisticationLevel, setSophisticationLevel] = useState<"level_1" | "level_2" | "level_3" | "level_4" | "level_5">("level_3");
  const [additionalContext, setAdditionalContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [showGeneratedDialog, setShowGeneratedDialog] = useState(false);
  const [savedIdeaIndexes, setSavedIdeaIndexes] = useState<Set<number>>(new Set());
  const [mediaType, setMediaType] = useState<"video" | "photo">("photo");
  const [copyType, setCopyType] = useState<"short" | "long">("long");
  const [targetPlatform, setTargetPlatform] = useState<"instagram" | "x" | "linkedin">("instagram");
  const [postCategory, setPostCategory] = useState<"ads" | "valore" | "formazione" | "altri">("ads");
  const [postSchema, setPostSchema] = useState<string>("originale");
  const [writingStyle, setWritingStyle] = useState<string>("default");
  const [customWritingInstructions, setCustomWritingInstructions] = useState<string>("");
  const [filterPlatform, setFilterPlatform] = useState<string>("all");
  const [isSuggestingLevels, setIsSuggestingLevels] = useState(false);
  const [isGeneratingNicheTarget, setIsGeneratingNicheTarget] = useState(false);
  const [showLevelsSuggestionDialog, setShowLevelsSuggestionDialog] = useState(false);
  const [levelsSuggestion, setLevelsSuggestion] = useState<{
    awarenessLevel: string;
    awarenessReason: string;
    sophisticationLevel: string;
    sophisticationReason: string;
  } | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterContentType, setFilterContentType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("score-desc");
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<string>>(new Set());
  
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(["all"]));
  const [viewingIdea, setViewingIdea] = useState<Idea | null>(null);
  const [showSchemaInfoDialog, setShowSchemaInfoDialog] = useState(false);
  
  // Brand Voice & KB states for idea generation
  const [useBrandVoice, setUseBrandVoice] = useState(false);
  const [brandVoiceData, setBrandVoiceData] = useState<BrandVoiceData>({});
  const [useKnowledgeBase, setUseKnowledgeBase] = useState(false);
  const [selectedKbDocIds, setSelectedKbDocIds] = useState<string[]>([]);
  const [tempFiles, setTempFiles] = useState<TempFile[]>([]);
  
  // Agent import for Brand Voice
  const [showImportAgentDialog, setShowImportAgentDialog] = useState(false);
  const [availableAgents, setAvailableAgents] = useState<any[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const [isImportingBrandVoice, setIsImportingBrandVoice] = useState(false);
  
  // Wizard accordion state
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(["brand"]));
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(section)) {
        newSet.delete(section);
      } else {
        newSet.add(section);
      }
      return newSet;
    });
  };
  
  // Get available schemas based on platform and category
  const availableSchemas = useMemo(() => {
    const schemas = POST_SCHEMAS[targetPlatform]?.[postCategory] || [];
    return schemas;
  }, [targetPlatform, postCategory]);

  // Get current platform info
  const currentPlatformInfo = useMemo(() => {
    return TARGET_PLATFORMS.find(p => p.value === targetPlatform);
  }, [targetPlatform]);

  // Get selected schema details
  const selectedSchemaDetails = useMemo(() => {
    if (!postSchema) return null;
    return availableSchemas.find(s => s.value === postSchema);
  }, [postSchema, availableSchemas]);

  // Calculate form completion progress - Nicchia, Target, Obiettivo, Piattaforma e Brand Voice sono obbligatori
  const formProgress = useMemo(() => {
    let completed = 0;
    const total = 5; // Nicchia, Target, Obiettivo, Piattaforma+Schema, Brand Voice
    if (topic?.trim()) completed++; // Nicchia compilata
    if (targetAudience?.trim()) completed++; // Pubblico Target compilato
    if (objective) completed++; // Obiettivo selezionato
    if (targetPlatform && postSchema) completed++; // Piattaforma e Schema selezionati
    if (useBrandVoice && Object.keys(brandVoiceData).length > 0) completed++; // Brand Voice configurato
    return { completed, total, percentage: Math.round((completed / total) * 100) };
  }, [topic, targetAudience, objective, targetPlatform, postSchema, useBrandVoice, brandVoiceData]);

  const toggleFilter = (filter: string) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev);
      if (filter === "all") {
        return new Set(["all"]);
      }
      newFilters.delete("all");
      if (newFilters.has(filter)) {
        newFilters.delete(filter);
        if (newFilters.size === 0) {
          return new Set(["all"]);
        }
      } else {
        newFilters.add(filter);
      }
      return newFilters;
    });
  };

  const [showSaveTemplateDialog, setShowSaveTemplateDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [showAutopilotSection, setShowAutopilotSection] = useState(false);
  const [autopilotStartDate, setAutopilotStartDate] = useState("");
  const [autopilotEndDate, setAutopilotEndDate] = useState("");
  const [autopilotPostsPerDay, setAutopilotPostsPerDay] = useState(2);
  const [isAutopilotGenerating, setIsAutopilotGenerating] = useState(false);
  const [autopilotProgress, setAutopilotProgress] = useState<{total: number; completed: number; currentDate?: string; currentPlatform?: string; currentDayIndex?: number; totalDays?: number} | null>(null);
  const [autopilotGeneratedPosts, setAutopilotGeneratedPosts] = useState<Array<{
    id: string;
    title: string;
    platform: string;
    date: string;
    charCount: number;
    charLimit: number;
    retries: number;
    theme: string;
    imageGenerated: boolean;
  }>>([]);

  // Multi-platform autopilot config
  interface AutopilotPlatformConfig {
    enabled: boolean;
    postsPerDay: number;
    postCategory: "ads" | "valore" | "formazione" | "altri";
    postSchema: string;
    mediaType: "photo" | "video" | "carousel" | "text";
    copyType: "short" | "long";
    writingStyle: string;
  }

  // Per-day configuration for autopilot
  interface PlatformDayConfig {
    postCategory: "ads" | "valore" | "formazione" | "altri";
    postSchema: string;
    mediaType: "photo" | "video" | "carousel" | "text";
    copyType: "short" | "long";
    writingStyle: string;
    hasExistingPosts?: number;
  }

  // Structure: autopilotPerDayConfig[date][platform] = PlatformDayConfig
  type PerDayConfigType = Record<string, Record<string, PlatformDayConfig>>;

  const [autopilotPlatforms, setAutopilotPlatforms] = useState<Record<string, AutopilotPlatformConfig>>({
    instagram: { enabled: true, postsPerDay: 2, postCategory: "ads", postSchema: "originale", mediaType: "photo", copyType: "long", writingStyle: "default" },
    x: { enabled: false, postsPerDay: 1, postCategory: "ads", postSchema: "originale", mediaType: "text", copyType: "short", writingStyle: "default" },
    linkedin: { enabled: false, postsPerDay: 1, postCategory: "valore", postSchema: "originale", mediaType: "photo", copyType: "long", writingStyle: "default" },
  });
  const [autopilotGenerateImages, setAutopilotGenerateImages] = useState(false);
  const [autopilotPublishToPubler, setAutopilotPublishToPubler] = useState(false);
  const [autopilotReviewMode, setAutopilotReviewMode] = useState(false);
  
  // Per-day configuration state (keyed by date YYYY-MM-DD)
  const [autopilotPerDayConfig, setAutopilotPerDayConfig] = useState<PerDayConfigType>({});
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());
  const [showPerDayConfig, setShowPerDayConfig] = useState(false);
  
  // Track if Brand Assets have been loaded to autopilot
  const [brandAssetsLoadedForAutopilot, setBrandAssetsLoadedForAutopilot] = useState(false);
  const [expandedAutopilotPlatforms, setExpandedAutopilotPlatforms] = useState<Set<string>>(new Set(["instagram"]));
  const [autopilotIncludeWeekends, setAutopilotIncludeWeekends] = useState(true);
  const [autopilotIncludeHolidays, setAutopilotIncludeHolidays] = useState(true);

  const toggleAutopilotPlatformExpanded = (platform: string) => {
    setExpandedAutopilotPlatforms(prev => {
      const newSet = new Set(prev);
      if (newSet.has(platform)) {
        newSet.delete(platform);
      } else {
        newSet.add(platform);
      }
      return newSet;
    });
  };

  const updateAutopilotPlatform = (platform: string, updates: Partial<AutopilotPlatformConfig>) => {
    setAutopilotPlatforms(prev => ({
      ...prev,
      [platform]: { ...prev[platform], ...updates }
    }));
  };

  const getAutopilotPlatformSchemas = (platform: string, category: string) => {
    return POST_SCHEMAS[platform]?.[category] || [];
  };

  // Helper: check if date is weekend (Saturday=6, Sunday=0)
  const isWeekend = (dateStr: string): boolean => {
    const date = new Date(dateStr);
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  // Helper: check if date is Italian holiday
  const isItalianHoliday = (dateStr: string): boolean => {
    const italianHolidays: Record<string, string[]> = {
      "2024": ["01-01", "01-06", "04-01", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"],
      "2025": ["01-01", "01-06", "04-21", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"],
      "2026": ["01-01", "01-06", "04-06", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"],
      "2027": ["01-01", "01-06", "03-29", "04-25", "05-01", "06-02", "08-15", "11-01", "12-08", "12-25", "12-26"],
    };
    const [year, month, day] = dateStr.split("-");
    const monthDay = `${month}-${day}`;
    return italianHolidays[year]?.includes(monthDay) || false;
  };

  // Helper: format date to Italian format (es. "29 Gen")
  const formatDateItalian = (dateStr: string): string => {
    const date = new Date(dateStr);
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

  // Helper: get weekday name in Italian
  const getWeekdayItalian = (dateStr: string): string => {
    const date = new Date(dateStr);
    const weekdays = ["Domenica", "Lunedì", "Martedì", "Mercoledì", "Giovedì", "Venerdì", "Sabato"];
    return weekdays[date.getDay()];
  };

  // Helper: generate dates array between start and end (optionally excluding weekends/holidays)
  const getWorkingDates = (startDate: string, endDate: string): string[] => {
    if (!startDate || !endDate) return [];
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split("T")[0];
      const skipWeekend = !autopilotIncludeWeekends && isWeekend(dateStr);
      const skipHoliday = !autopilotIncludeHolidays && isItalianHoliday(dateStr);
      if (!skipWeekend && !skipHoliday) {
        dates.push(dateStr);
      }
    }
    return dates;
  };

  // Toggle day expanded
  const toggleDayExpanded = (date: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  // Update per-day, per-platform config
  const updateDayConfig = (date: string, platform: string, updates: Partial<PlatformDayConfig>) => {
    setAutopilotPerDayConfig(prev => ({
      ...prev,
      [date]: {
        ...prev[date],
        [platform]: { ...prev[date]?.[platform], ...updates }
      }
    }));
  };

  // Get default config for a specific platform
  const getDefaultPlatformDayConfig = (platform: string): PlatformDayConfig => {
    const platformConfig = autopilotPlatforms[platform];
    if (platformConfig) {
      return {
        postCategory: platformConfig.postCategory,
        postSchema: platformConfig.postSchema,
        mediaType: platformConfig.mediaType,
        copyType: platformConfig.copyType,
        writingStyle: platformConfig.writingStyle,
      };
    }
    return {
      postCategory: "ads",
      postSchema: "originale",
      mediaType: "photo",
      copyType: "long",
      writingStyle: "default",
    };
  };

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: templatesResponse } = useQuery({
    queryKey: ["/api/content/idea-templates"],
    queryFn: async () => {
      const response = await fetch("/api/content/idea-templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      return response.json();
    },
  });
  const templates = templatesResponse?.data || [];

  const { data: brandVoiceResponse, refetch: refetchBrandVoice } = useQuery({
    queryKey: ["/api/content/brand-voice"],
    queryFn: async () => {
      const response = await fetch("/api/content/brand-voice", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { brandVoice: {} };
      return response.json();
    },
  });

  const { data: brandAssetsResponse } = useQuery({
    queryKey: ["/api/content/brand-assets"],
    queryFn: async () => {
      const response = await fetch("/api/content/brand-assets", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { data: null };
      return response.json();
    },
  });

  const xPremiumSubscription = brandAssetsResponse?.data?.xPremiumSubscription || false;

  const dynamicPlatformLimits = useMemo(() => ({
    instagram: { caption: 2200, hashtags: 30, description: "Caption max 2.200 caratteri" },
    x: { 
      tweet: xPremiumSubscription ? 4000 : 280, 
      thread: 25000, 
      description: xPremiumSubscription ? "Post X Premium max 4.000 caratteri" : "Tweet max 280 caratteri" 
    },
    linkedin: { post: 3000, article: 125000, description: "Post max 3.000 caratteri" },
  }), [xPremiumSubscription]);

  // Sync autopilot platforms with Brand Assets posting schedule
  useEffect(() => {
    if (brandAssetsResponse?.data?.postingSchedule && !brandAssetsLoadedForAutopilot) {
      const schedule = brandAssetsResponse.data.postingSchedule;
      
      setAutopilotPlatforms(prev => ({
        instagram: {
          ...prev.instagram,
          postsPerDay: schedule.instagram?.times?.length || 2,
          writingStyle: schedule.instagram?.writingStyle || prev.instagram.writingStyle,
        },
        x: {
          ...prev.x,
          postsPerDay: schedule.x?.times?.length || 1,
          writingStyle: schedule.x?.writingStyle || prev.x.writingStyle,
        },
        linkedin: {
          ...prev.linkedin,
          postsPerDay: schedule.linkedin?.times?.length || 1,
          writingStyle: schedule.linkedin?.writingStyle || prev.linkedin.writingStyle,
        },
      }));
      
      setBrandAssetsLoadedForAutopilot(true);
    }
  }, [brandAssetsResponse, brandAssetsLoadedForAutopilot]);

  // Populate per-day configurations when date range changes
  useEffect(() => {
    if (!autopilotStartDate || !autopilotEndDate) {
      setAutopilotPerDayConfig({});
      return;
    }
    
    const workingDates = getWorkingDates(autopilotStartDate, autopilotEndDate);
    const enabledPlatforms = Object.entries(autopilotPlatforms)
      .filter(([_, config]) => config.enabled)
      .map(([platform]) => platform);
    
    setAutopilotPerDayConfig(prev => {
      const newConfig: PerDayConfigType = {};
      workingDates.forEach(date => {
        newConfig[date] = {};
        enabledPlatforms.forEach(platform => {
          if (prev[date]?.[platform]) {
            newConfig[date][platform] = prev[date][platform];
          } else {
            newConfig[date][platform] = getDefaultPlatformDayConfig(platform);
          }
        });
      });
      return newConfig;
    });
  }, [autopilotStartDate, autopilotEndDate, autopilotPlatforms, autopilotIncludeWeekends, autopilotIncludeHolidays]);

  // Query to check existing posts for conflict detection
  const { data: existingPostsForDateRange } = useQuery({
    queryKey: ["/api/content/posts", "date-range-check", autopilotStartDate, autopilotEndDate],
    queryFn: async () => {
      if (!autopilotStartDate || !autopilotEndDate) return { data: [] };
      const response = await fetch(`/api/content/posts?startDate=${autopilotStartDate}&endDate=${autopilotEndDate}&status=scheduled`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { data: [] };
      return response.json();
    },
    enabled: !!autopilotStartDate && !!autopilotEndDate,
  });

  // Update per-day config with existing post counts (by platform)
  useEffect(() => {
    if (!existingPostsForDateRange?.data) return;
    
    // Count posts by date AND platform
    const postCountByDatePlatform: Record<string, Record<string, number>> = {};
    existingPostsForDateRange.data.forEach((post: any) => {
      if (post.scheduledAt && post.platform) {
        const dateStr = new Date(post.scheduledAt).toISOString().split("T")[0];
        // Map DB platform names to frontend names
        const platformMap: Record<string, string> = { twitter: "x", instagram: "instagram", linkedin: "linkedin" };
        const platform = platformMap[post.platform] || post.platform;
        if (!postCountByDatePlatform[dateStr]) postCountByDatePlatform[dateStr] = {};
        postCountByDatePlatform[dateStr][platform] = (postCountByDatePlatform[dateStr][platform] || 0) + 1;
      }
    });
    
    setAutopilotPerDayConfig(prev => {
      const updated: PerDayConfigType = {};
      Object.entries(prev).forEach(([date, platforms]) => {
        updated[date] = {};
        Object.entries(platforms).forEach(([platform, config]) => {
          updated[date][platform] = {
            ...config,
            hasExistingPosts: postCountByDatePlatform[date]?.[platform] || 0,
          };
        });
      });
      return updated;
    });
  }, [existingPostsForDateRange]);

  // State for saving brand voice
  const [isSavingBrandVoice, setIsSavingBrandVoice] = useState(false);

  // Sync brand voice data and enabled state when loaded
  useEffect(() => {
    if (brandVoiceResponse?.brandVoice) {
      setBrandVoiceData(brandVoiceResponse.brandVoice);
    }
    if (brandVoiceResponse?.enabled !== undefined) {
      setUseBrandVoice(brandVoiceResponse.enabled);
    }
  }, [brandVoiceResponse]);

  // Auto-suggest postCategory based on objective
  useEffect(() => {
    if (!objective) return;
    
    let suggestedCategory: "ads" | "valore" | "formazione" | "altri" = "ads";
    
    switch (objective) {
      case "sales":
      case "leads":
        suggestedCategory = "ads";
        break;
      case "engagement":
      case "education":
      case "authority":
        suggestedCategory = "valore";
        break;
      case "awareness":
        suggestedCategory = "altri";
        break;
      default:
        suggestedCategory = "ads";
    }
    
    // Check if the suggested category has schemas for current platform
    const hasSchemas = (POST_SCHEMAS[targetPlatform]?.[suggestedCategory]?.length || 0) > 0;
    
    if (hasSchemas && postCategory !== suggestedCategory) {
      setPostCategory(suggestedCategory);
      setPostSchema("");
    }
  }, [objective, targetPlatform]);

  // Save Brand Voice to Content Studio config
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const handleSaveBrandVoice = async () => {
    setIsSavingBrandVoice(true);
    setSaveSuccess(false);
    try {
      const response = await fetch("/api/content/brand-voice", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          brandVoice: brandVoiceData,
          enabled: useBrandVoice,
        }),
      });
      
      if (response.ok) {
        setSaveSuccess(true);
        toast({
          title: "Salvato",
          description: "Brand Voice salvato con successo per Content Studio",
        });
        refetchBrandVoice();
        // Reset success state after animation
        setTimeout(() => setSaveSuccess(false), 2000);
      } else {
        throw new Error("Errore nel salvataggio");
      }
    } catch (error: any) {
      toast({
        title: "Errore",
        description: error.message || "Impossibile salvare il Brand Voice",
        variant: "destructive",
      });
    } finally {
      setIsSavingBrandVoice(false);
    }
  };

  // Load available agents for Brand Voice import
  const loadAvailableAgents = async () => {
    setSelectedAgentId(""); // Reset selection on each open
    try {
      const res = await fetch("/api/whatsapp/agent-chat/agents", { headers: getAuthHeaders() });
      if (res.ok) {
        const response = await res.json();
        setAvailableAgents(response.data || []);
      } else {
        setAvailableAgents([]);
        toast({ title: "Errore", description: "Impossibile caricare gli agenti", variant: "destructive" });
      }
    } catch (error: any) {
      setAvailableAgents([]);
      toast({ title: "Errore", description: "Impossibile caricare gli agenti", variant: "destructive" });
    }
  };

  // Handle import Brand Voice from agent
  const handleImportFromAgent = async () => {
    if (!selectedAgentId) return;
    setIsImportingBrandVoice(true);
    try {
      const res = await fetch(`/api/whatsapp/agents/${selectedAgentId}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore caricamento agente");
      const agent = await res.json();
      if (agent) {
        setBrandVoiceData({
          consultantDisplayName: agent.consultantDisplayName,
          businessName: agent.businessName,
          businessDescription: agent.businessDescription,
          consultantBio: agent.consultantBio,
          vision: agent.vision,
          mission: agent.mission,
          values: agent.values,
          usp: agent.usp,
          whoWeHelp: agent.whoWeHelp,
          whoWeDontHelp: agent.whoWeDontHelp,
          whatWeDo: agent.whatWeDo,
          howWeDoIt: agent.howWeDoIt,
          yearsExperience: agent.yearsExperience,
          clientsHelped: agent.clientsHelped,
          resultsGenerated: agent.resultsGenerated,
          softwareCreated: agent.softwareCreated,
          booksPublished: agent.booksPublished,
          caseStudies: agent.caseStudies,
          servicesOffered: agent.servicesOffered,
          guarantees: agent.guarantees,
        });
        toast({ title: "Dati importati", description: "Brand Voice importato dall'agente" });
        setShowImportAgentDialog(false);
        setUseBrandVoice(true);
      }
    } catch (error: any) {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsImportingBrandVoice(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) return;
    try {
      const response = await fetch("/api/content/idea-templates", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName,
          topic,
          targetAudience,
          objective,
          additionalContext,
          awarenessLevel,
          sophisticationLevel,
          mediaType,
          copyType,
        }),
      });
      if (response.ok) {
        toast({ title: "Template salvato!", description: `"${templateName}" è stato salvato` });
        setShowSaveTemplateDialog(false);
        setTemplateName("");
        queryClient.invalidateQueries({ queryKey: ["/api/content/idea-templates"] });
      }
    } catch (error) {
      toast({ title: "Errore", description: "Impossibile salvare il template", variant: "destructive" });
    }
  };

  const handleLoadTemplate = (template: any) => {
    setTopic(template.topic || "");
    setTargetAudience(template.targetAudience || "");
    setObjective(template.objective || "");
    setAdditionalContext(template.additionalContext || "");
    setAwarenessLevel(template.awarenessLevel || "problem_aware");
    setSophisticationLevel(template.sophisticationLevel || "level_3");
    setMediaType(template.mediaType || "photo");
    setCopyType(template.copyType || "short");
    toast({ title: "Template caricato", description: `"${template.name}" applicato` });
  };

  const handleDevelopPost = (idea: Idea) => {
    if (idea.id) {
      setLocation(`/consultant/content-studio/posts?ideaId=${idea.id}`);
    } else {
      toast({
        title: "Errore",
        description: "Idea non valida: ID mancante",
        variant: "destructive",
      });
    }
  };

  const { data: ideasResponse, isLoading } = useQuery({
    queryKey: ["/api/content/ideas"],
    queryFn: async () => {
      const response = await fetch("/api/content/ideas", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch ideas");
      return response.json();
    },
  });

  const ideas: Idea[] = ideasResponse?.data || [];

  const filteredAndSortedIdeas = useMemo(() => {
    let result = [...ideas];

    // Filtra per stato
    if (statusFilter === "all") {
      // "Tutte" mostra solo idee NON sviluppate (senza developedPostId e status !== "developed")
      result = result.filter((idea) => !idea.developedPostId && idea.status !== "developed");
    } else if (statusFilter === "developed") {
      // "Sviluppate" mostra solo idee già sviluppate
      result = result.filter((idea) => idea.status === "developed" || idea.developedPostId);
    } else {
      // Altri filtri (new, in_progress, archived) - escludono sempre le sviluppate
      result = result.filter((idea) => idea.status === statusFilter && !idea.developedPostId);
    }

    if (filterContentType !== "all") {
      result = result.filter((idea) =>
        idea.contentType?.toLowerCase().includes(filterContentType.toLowerCase())
      );
    }

    // Filtra per piattaforma
    if (filterPlatform !== "all") {
      result = result.filter((idea) => idea.targetPlatform === filterPlatform);
    }

    if (!activeFilters.has("all")) {
      result = result.filter((idea) => {
        const matchesVideo = activeFilters.has("video") && idea.mediaType === "video";
        const matchesPhoto = activeFilters.has("photo") && idea.mediaType === "photo";
        const matchesLong = activeFilters.has("long") && idea.copyType === "long";
        const matchesShort = activeFilters.has("short") && idea.copyType === "short";
        
        const hasMediaFilter = activeFilters.has("video") || activeFilters.has("photo");
        const hasCopyFilter = activeFilters.has("long") || activeFilters.has("short");
        
        const matchesMedia = !hasMediaFilter || matchesVideo || matchesPhoto;
        const matchesCopy = !hasCopyFilter || matchesLong || matchesShort;
        
        return matchesMedia && matchesCopy;
      });
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "score-desc":
          return (b.score || 0) - (a.score || 0);
        case "date-desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "content-type":
          return (a.contentType || "").localeCompare(b.contentType || "");
        case "platform":
          return (a.targetPlatform || "").localeCompare(b.targetPlatform || "");
        default:
          return 0;
      }
    });

    return result;
  }, [ideas, statusFilter, filterContentType, sortBy, activeFilters, filterPlatform]);

  const createIdeaMutation = useMutation({
    mutationFn: async (idea: Partial<Idea>) => {
      const response = await fetch("/api/content/ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(idea),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create idea");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea salvata",
        description: "L'idea è stata salvata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const response = await fetch(`/api/content/ideas/${ideaId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete idea");
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Idea eliminata",
        description: "L'idea è stata eliminata con successo",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateIdeaStatusMutation = useMutation({
    mutationFn: async ({ ideaId, status, developedPostId }: { ideaId: string; status: IdeaStatus; developedPostId?: string }) => {
      const response = await fetch(`/api/content/ideas/${ideaId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, developedPostId }),
      });
      if (!response.ok) throw new Error("Failed to update idea status");
      return response.json();
    },
    onSuccess: (_, variables) => {
      const statusLabels: Record<IdeaStatus, string> = {
        new: "Nuova",
        in_progress: "In Lavorazione",
        developed: "Sviluppata",
        archived: "Archiviata",
      };
      toast({
        title: "Stato aggiornato",
        description: `L'idea è stata segnata come "${statusLabels[variables.status]}"`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to sync developed ideas with their posts
  const syncDevelopedMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/content/ideas/sync-developed", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to sync");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Sincronizzazione completata",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/content/ideas"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // State for tracking which ideas are being shortened
  const [shorteningIndexes, setShorteningIndexes] = useState<Set<number>>(new Set());

  // Mutation to shorten copy that exceeds platform limit
  const shortenCopyMutation = useMutation({
    mutationFn: async ({ originalCopy, targetLimit, platform, index }: { 
      originalCopy: string; 
      targetLimit: number; 
      platform: string;
      index: number;
    }) => {
      const response = await fetch("/api/content/ai/shorten-copy", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ originalCopy, targetLimit, platform }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to shorten copy");
      }
      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to shorten copy");
      }
      return { data, index };
    },
    onMutate: async (variables) => {
      // Set loading state before mutation starts
      setShorteningIndexes(prev => new Set(prev).add(variables.index));
    },
    onSuccess: ({ data, index }) => {
      // Update the generated idea with shortened copy
      if (data.data?.shortenedCopy) {
        setGeneratedIdeas(prev => {
          const updated = [...prev];
          if (updated[index]) {
            updated[index] = {
              ...updated[index],
              copyContent: data.data.shortenedCopy,
            };
          }
          return updated;
        });
        const withinLimit = data.data.withinLimit;
        toast({
          title: withinLimit ? "Copy accorciato" : "Copy ridotto",
          description: withinLimit 
            ? `Ridotto da ${data.data.originalLength} a ${data.data.newLength} caratteri`
            : `Ridotto a ${data.data.newLength} caratteri (potrebbe servire un altro passaggio)`,
          variant: withinLimit ? "default" : "destructive",
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
    onSettled: (_, __, variables) => {
      // Always clean up loading state
      setShorteningIndexes(prev => {
        const next = new Set(prev);
        next.delete(variables.index);
        return next;
      });
    },
  });

  const handleStatusChange = (ideaId: string, newStatus: IdeaStatus) => {
    updateIdeaStatusMutation.mutate({ ideaId, status: newStatus });
  };

  const handleSuggestLevels = async () => {
    if (!topic && !targetAudience && !brandVoiceData) {
      toast({ title: "Inserisci Topic, Target Audience o Brand Voice", variant: "destructive" });
      return;
    }
    setIsSuggestingLevels(true);
    try {
      const response = await fetch("/api/content/ai/suggest-levels", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ 
          topic, 
          targetAudience, 
          objective,
          mediaType,
          copyType,
          additionalContext,
          brandVoiceData: useBrandVoice ? brandVoiceData : null,
        }),
      });
      const data = await response.json();
      if (data.awarenessLevel) setAwarenessLevel(data.awarenessLevel);
      if (data.sophisticationLevel) setSophisticationLevel(data.sophisticationLevel);
      setLevelsSuggestion(data);
      setShowLevelsSuggestionDialog(true);
    } catch (error) {
      toast({ title: "Errore nel suggerimento", variant: "destructive" });
    } finally {
      setIsSuggestingLevels(false);
    }
  };

  const handleGoToPost = (postId: string) => {
    setLocation(`/consultant/content-studio/posts?postId=${postId}`);
  };

  const handleGenerateNicheTarget = async () => {
    if (!useBrandVoice || Object.keys(brandVoiceData).length === 0) {
      toast({ title: "Configura prima Brand Voice", variant: "destructive" });
      return;
    }
    setIsGeneratingNicheTarget(true);
    try {
      const response = await fetch("/api/content/ai/suggest-niche-target", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ brandVoiceData }),
      });
      const data = await response.json();
      if (data.success && data.data) {
        if (data.data.niche) setTopic(data.data.niche);
        if (data.data.targetAudience) setTargetAudience(data.data.targetAudience);
        toast({ title: "Nicchia e Target generati!", description: "Puoi modificarli se necessario" });
      } else {
        throw new Error(data.error || "Errore nella generazione");
      }
    } catch (error: any) {
      toast({ title: "Errore nella generazione", description: error.message, variant: "destructive" });
    } finally {
      setIsGeneratingNicheTarget(false);
    }
  };

  const handleGenerateIdeas = async () => {
    // Validazione campi obbligatori
    const hasBrandVoice = useBrandVoice && Object.keys(brandVoiceData).length > 0;
    
    // topic (niche) e targetAudience sono obbligatori nel server
    if (!topic?.trim() || !targetAudience?.trim()) {
      toast({
        title: "Campi obbligatori",
        description: "Inserisci l'argomento (Niche) e il pubblico target per generare le idee",
        variant: "destructive",
      });
      return;
    }
    
    if (!objective || !hasBrandVoice) {
      toast({
        title: "Campi obbligatori",
        description: "Seleziona un obiettivo e configura Brand Voice per generare le idee",
        variant: "destructive",
      });
      return;
    }

    if (!postSchema) {
      toast({
        title: "Schema richiesto",
        description: "Seleziona uno schema per il post nella sezione Piattaforma & Schema",
        variant: "destructive",
      });
      return;
    }

    const selectedSchema = availableSchemas.find(s => s.value === postSchema);
    const platformLimit = dynamicPlatformLimits[targetPlatform];

    setIsGenerating(true);
    
    // Debug log per verificare lo stato di writingStyle
    console.log("[GENERATE] Current writingStyle state:", writingStyle);
    console.log("[GENERATE] customWritingInstructions:", customWritingInstructions);
    
    try {
      const response = await fetch("/api/content/ai/generate-ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          niche: topic,
          targetAudience,
          objective,
          count: ideaCount,
          additionalContext,
          mediaType,
          copyType,
          awarenessLevel,
          sophisticationLevel,
          targetPlatform,
          postCategory,
          postSchema,
          schemaStructure: selectedSchema?.structure,
          schemaLabel: selectedSchema?.label,
          charLimit: targetPlatform === "x" ? platformLimit.tweet : (targetPlatform === "linkedin" ? platformLimit.post : platformLimit.caption),
          writingStyle,
          customWritingInstructions: writingStyle === "custom" ? customWritingInstructions : undefined,
          ...(useBrandVoice && Object.keys(brandVoiceData).length > 0 && { brandVoiceData }),
          ...(useKnowledgeBase && selectedKbDocIds.length > 0 && { kbDocumentIds: selectedKbDocIds }),
          ...(useKnowledgeBase && tempFiles.filter(f => f.status === "success").length > 0 && { 
            kbContent: tempFiles
              .filter(f => f.status === "success")
              .map(f => `## ${f.title}\n\n${f.content}`)
              .join("\n\n---\n\n")
          }),
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate ideas");
      }

      const result = await response.json();
      const ideas = result.data.ideas || [];
      setGeneratedIdeas(ideas);
      
      // Reset saved indexes - user decides what to save manually
      setSavedIdeaIndexes(new Set());
      setShowGeneratedDialog(true);
      
      toast({
        title: "Idee generate!",
        description: `${ideas.length} idee pronte. Clicca "Salva" su quelle che vuoi conservare.`,
      });
    } catch (error: any) {
      toast({
        title: "Errore nella generazione",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAutopilotGenerate = async () => {
    if (!autopilotStartDate || !autopilotEndDate) return;
    
    const enabledPlatforms = Object.entries(autopilotPlatforms).filter(([_, config]) => config.enabled);
    if (enabledPlatforms.length === 0) {
      toast({
        title: "Nessuna piattaforma selezionata",
        description: "Abilita almeno una piattaforma per avviare l'autopilot.",
        variant: "destructive",
      });
      return;
    }
    
    setIsAutopilotGenerating(true);
    setAutopilotProgress(null);
    setAutopilotGeneratedPosts([]);
    
    try {
      const kbContentParts: string[] = [];
      if (useKnowledgeBase && tempFiles.filter(f => f.status === "success").length > 0) {
        for (const file of tempFiles.filter(f => f.status === "success")) {
          if (file.content) {
            kbContentParts.push(`## ${file.title}\n\n${file.content}`);
          }
        }
      }
      const kbContent = kbContentParts.join("\n\n---\n\n");
      
      const platformsPayload = Object.fromEntries(
        enabledPlatforms.map(([platform, config]) => {
          const platformSchemas = POST_SCHEMAS[platform as keyof typeof POST_SCHEMAS]?.[config.postCategory] || [];
          const selectedSchema = platformSchemas.find(s => s.value === config.postSchema);
          const platformInfo = TARGET_PLATFORMS.find(p => p.value === platform);
          return [
            platform,
            {
              enabled: true,
              postsPerDay: config.postsPerDay,
              postCategory: config.postCategory,
              postSchema: config.postSchema,
              schemaStructure: selectedSchema?.structure,
              schemaLabel: selectedSchema?.label,
              mediaType: config.mediaType,
              copyType: config.copyType,
              writingStyle: config.writingStyle,
              charLimit: platformInfo?.charLimit || 2200,
            }
          ];
        })
      );
      
      // Build per-day config payload with schema structures - now per platform
      const perDayConfigPayload: Record<string, Record<string, any>> = {};
      Object.entries(autopilotPerDayConfig).forEach(([date, dayConfig]) => {
        perDayConfigPayload[date] = {};
        
        // For each enabled platform, build config with correct schema from that platform
        enabledPlatforms.forEach(([platform, platformConfig]) => {
          const platformSchemas = POST_SCHEMAS[platform as keyof typeof POST_SCHEMAS]?.[dayConfig.postCategory] || [];
          const selectedSchema = platformSchemas.find(s => s.value === dayConfig.postSchema);
          
          perDayConfigPayload[date][platform] = {
            ...dayConfig,
            schemaStructure: selectedSchema?.structure,
            schemaLabel: selectedSchema?.label,
          };
        });
      });
      
      const response = await fetch("/api/content/autopilot/generate", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: autopilotStartDate,
          endDate: autopilotEndDate,
          platforms: platformsPayload,
          perDayConfig: perDayConfigPayload,
          excludeWeekends: !autopilotIncludeWeekends,
          excludeHolidays: !autopilotIncludeHolidays,
          niche: brandVoiceData.niche || topic || "",
          targetAudience: brandVoiceData.targetAudience || targetAudience || "",
          objective: objective,
          awarenessLevel: awarenessLevel,
          sophisticationLevel: sophisticationLevel,
          brandVoiceData: useBrandVoice ? brandVoiceData : undefined,
          kbContent: kbContent || undefined,
          autoGenerateImages: autopilotGenerateImages,
          autoPublish: autopilotPublishToPubler,
          reviewMode: autopilotReviewMode,
          ...(useKnowledgeBase && selectedKbDocIds.length > 0 && { kbDocumentIds: selectedKbDocIds }),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to start autopilot");
      }
      
      const { batchId } = await response.json();
      
      if (!batchId) {
        throw new Error("No batch ID returned");
      }
      
      // Polling loop - check status every 2 seconds
      const pollStatus = async (): Promise<boolean> => {
        try {
          const statusRes = await fetch(`/api/content/autopilot/batch/${batchId}/status`, {
            headers: getAuthHeaders(),
          });
          
          if (!statusRes.ok) {
            console.error("Polling error:", statusRes.status);
            return false;
          }
          
          const { data } = await statusRes.json();
          
          // Update progress
          setAutopilotProgress({
            total: data.totalPosts || 0,
            completed: data.generatedPosts || 0,
            currentDate: data.processingDate || "",
            currentPlatform: data.processingPlatform || "",
            currentDayIndex: data.currentDayIndex || 0,
            totalDays: data.totalDays || 0,
          });
          
          // Update generated posts details
          if (data.generatedPostsDetails && data.generatedPostsDetails.length > 0) {
            setAutopilotGeneratedPosts(data.generatedPostsDetails);
          }
          
          // Check completion status
          if (data.status === "awaiting_review" || data.status === "completed" || data.status === "published") {
            toast({
              title: "Autopilot completato!",
              description: `${data.generatedPosts} post generati con successo`,
            });
            queryClient.invalidateQueries({ queryKey: ["/api/content/posts"] });
            return true; // Stop polling
          }
          
          if (data.status === "failed") {
            throw new Error(data.lastError || "Generation failed");
          }
          
          return false; // Continue polling
        } catch (err) {
          console.error("Polling error:", err);
          return false;
        }
      };
      
      // Poll every 2 seconds until complete
      let attempts = 0;
      const maxAttempts = 300; // 10 minutes max
      while (attempts < maxAttempts) {
        const done = await pollStatus();
        if (done) break;
        await new Promise(resolve => setTimeout(resolve, 2000));
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        toast({
          title: "Timeout",
          description: "La generazione sta impiegando troppo tempo. Controlla i post generati.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Autopilot error:", error);
      toast({
        title: "Errore Autopilot",
        description: error.message || "Errore durante la generazione",
        variant: "destructive",
      });
    } finally {
      setIsAutopilotGenerating(false);
    }
  };

  const handleSaveGeneratedIdea = (idea: any, index: number) => {
    const selectedSchema = availableSchemas.find(s => s.value === postSchema);
    createIdeaMutation.mutate({
      title: idea.title,
      description: idea.description,
      suggestedHook: idea.suggestedHook,
      suggestedCta: idea.suggestedCta,
      aiScore: idea.aiScore || 80,
      aiReasoning: idea.aiReasoning,
      targetAudience: targetAudience,
      status: "draft",
      mediaType: idea.mediaType || mediaType,
      copyType: idea.copyType || copyType,
      videoScript: idea.videoScript,
      imageDescription: idea.imageDescription || idea.structuredContent?.imageDescription,
      imageOverlayText: idea.imageOverlayText || idea.structuredContent?.imageOverlayText,
      copyContent: idea.copyContent,
      structuredContent: idea.structuredContent,
      awarenessLevel: awarenessLevel,
      targetPlatform: targetPlatform,
      postCategory: postCategory,
      postSchema: postSchema,
      schemaStructure: selectedSchema?.structure,
      writingStyle: writingStyle,
      customWritingInstructions: writingStyle === "custom" ? customWritingInstructions : undefined,
    }, {
      onSuccess: () => {
        setSavedIdeaIndexes(prev => new Set(prev).add(index));
        toast({
          title: "Idea salvata!",
          description: `"${idea.title}" è stata aggiunta alle tue idee`,
        });
      }
    });
  };

  const getScoreColor = (score: number) => {
    if (score >= 85) return "text-green-600 bg-green-500/10";
    if (score >= 70) return "text-amber-600 bg-amber-500/10";
    return "text-red-600 bg-red-500/10";
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Lightbulb className="h-8 w-8 text-amber-500" />
                  Generatore Idee
                </h1>
                <p className="text-muted-foreground">
                  Genera idee creative per i tuoi contenuti con l'AI
                </p>
              </div>
            </div>

            {/* Wizard Form - Clean 3-Step Structure */}
            <div className="space-y-4">
              {/* Progress Bar */}
              <Card className="border-0 shadow-sm bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      Completamento: {formProgress.completed}/{formProgress.total} campi obbligatori
                    </span>
                    <span className="text-sm font-bold text-purple-600 dark:text-purple-400">
                      {formProgress.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-gradient-to-r from-purple-500 to-blue-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${formProgress.percentage}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Step 1: Objective & Format */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("objective")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 hover:from-purple-100 hover:to-pink-100 dark:hover:from-purple-950/40 dark:hover:to-pink-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-purple-500 flex items-center justify-center text-white font-bold text-sm">1</div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Obiettivo & Formato</h3>
                      <p className="text-xs text-muted-foreground">Cosa vuoi ottenere e come</p>
                    </div>
                    {objective && topic?.trim() && targetAudience?.trim() && (
                      <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("objective") ? "rotate-180" : ""}`} />
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("objective") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                  <CardContent className="pt-4 space-y-5">
                    {/* Nicchia e Pubblico Target - Campi obbligatori */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">Nicchia e Pubblico Target *</Label>
                        {useBrandVoice && Object.keys(brandVoiceData).length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleGenerateNicheTarget}
                            disabled={isGeneratingNicheTarget}
                            className="h-8 text-xs gap-1.5 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800 hover:from-purple-100 hover:to-pink-100"
                          >
                            {isGeneratingNicheTarget ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Wand2 className="h-3 w-3" />
                            )}
                            Genera con AI
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          placeholder="es. Finanza personale, Fitness, Marketing..."
                          value={topic}
                          onChange={(e) => setTopic(e.target.value)}
                          className="h-10"
                        />
                        <Input
                          placeholder="es. Imprenditori 35-50, Mamme lavoratrici..."
                          value={targetAudience}
                          onChange={(e) => setTargetAudience(e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>

                    {/* Objectives as compact pills with tooltips */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Obiettivo *</Label>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap gap-2">
                          {OBJECTIVES.map((obj) => {
                            const IconComponent = obj.icon;
                            const isSelected = objective === obj.value;
                            return (
                              <Tooltip key={obj.value}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setObjective(obj.value)}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                                      isSelected
                                        ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                                        : "bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground"
                                    }`}
                                  >
                                    <IconComponent className="h-4 w-4" />
                                    {obj.label}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p className="text-xs">{obj.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Media & Copy Type - Inline Selection */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo Media</Label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setMediaType("video")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              mediaType === "video"
                                ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
                                : "border-border hover:border-blue-300"
                            }`}
                          >
                            <Video className="h-4 w-4" />
                            <span className="font-medium text-sm">Video</span>
                          </button>
                          <button
                            onClick={() => setMediaType("photo")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              mediaType === "photo"
                                ? "border-green-500 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-300"
                                : "border-border hover:border-green-300"
                            }`}
                          >
                            <Camera className="h-4 w-4" />
                            <span className="font-medium text-sm">Foto</span>
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Tipo Copy</Label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => setCopyType("short")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              copyType === "short"
                                ? "border-orange-500 bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300"
                                : "border-border hover:border-orange-300"
                            }`}
                          >
                            <FileTextIcon className="h-4 w-4" />
                            <span className="font-medium text-sm">Corto</span>
                          </button>
                          <button
                            onClick={() => setCopyType("long")}
                            className={`flex-1 px-3 py-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                              copyType === "long"
                                ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30 text-purple-700 dark:text-purple-300"
                                : "border-border hover:border-purple-300"
                            }`}
                          >
                            <AlignLeft className="h-4 w-4" />
                            <span className="font-medium text-sm">Lungo</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Writing Style Selection */}
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Stile di Scrittura</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {WRITING_STYLES.map((style) => (
                          <button
                            type="button"
                            key={style.value}
                            onClick={() => {
                              console.log("[WRITING_STYLE] Setting style to:", style.value);
                              setWritingStyle(style.value);
                            }}
                            className={`p-2.5 rounded-lg border-2 transition-all text-left ${
                              writingStyle === style.value
                                ? "border-teal-500 bg-teal-50 dark:bg-teal-950/30"
                                : "border-border hover:border-teal-300"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{style.icon}</span>
                              <span className={`font-medium text-sm ${writingStyle === style.value ? "text-teal-700 dark:text-teal-300" : ""}`}>
                                {style.label}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{style.description}</p>
                          </button>
                        ))}
                      </div>
                      {writingStyle === "custom" && (
                        <Textarea
                          placeholder="Descrivi come vuoi che scriva l'AI... Es: 'Usa un tono ironico e provocatorio, con riferimenti alla cultura pop italiana'"
                          value={customWritingInstructions}
                          onChange={(e) => setCustomWritingInstructions(e.target.value)}
                          className="mt-2 min-h-[80px]"
                        />
                      )}
                    </div>

                    {/* Number of ideas - compact */}
                    <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                      <Label className="text-sm font-medium whitespace-nowrap">Numero Idee:</Label>
                      <Slider
                        value={[ideaCount]}
                        onValueChange={(value) => setIdeaCount(value[0])}
                        min={1}
                        max={5}
                        step={1}
                        className="flex-1"
                      />
                      <span className="text-lg font-bold text-purple-600 dark:text-purple-400 min-w-[2rem] text-center">{ideaCount}</span>
                    </div>
                  </CardContent>
                  </div>
                </div>
              </Card>

              {/* Step 2: Piattaforma & Schema */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("platform")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 hover:from-indigo-100 hover:to-violet-100 dark:hover:from-indigo-950/40 dark:hover:to-violet-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-white font-bold text-sm">2</div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Piattaforma & Schema</h3>
                      <p className="text-xs text-muted-foreground">Dove vuoi pubblicare e che struttura usare</p>
                    </div>
                    {targetPlatform && postSchema && (
                      <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("platform") ? "rotate-180" : ""}`} />
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("platform") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <CardContent className="pt-4 space-y-5">
                      {/* Platform Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Piattaforma Target *</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {TARGET_PLATFORMS.map((platform) => {
                            const IconComponent = platform.icon;
                            const isSelected = targetPlatform === platform.value;
                            return (
                              <button
                                key={platform.value}
                                onClick={() => {
                                  if (targetPlatform !== platform.value) {
                                    setTargetPlatform(platform.value);
                                    setPostSchema("");
                                  }
                                }}
                                className={`p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${
                                  isSelected
                                    ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                                    : "border-muted hover:border-indigo-200 dark:hover:border-indigo-800"
                                }`}
                              >
                                <div className={`h-10 w-10 rounded-full ${platform.color} flex items-center justify-center`}>
                                  <IconComponent className="h-5 w-5 text-white" />
                                </div>
                                <span className={`text-sm font-medium ${isSelected ? "text-indigo-700 dark:text-indigo-300" : "text-muted-foreground"}`}>
                                  {platform.label}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  Max {(platform.value === 'x' ? dynamicPlatformLimits.x.tweet : platform.value === 'linkedin' ? dynamicPlatformLimits.linkedin.post : dynamicPlatformLimits.instagram.caption).toLocaleString()} char
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Category Selection */}
                      <div className="space-y-3">
                        <Label className="text-sm font-medium">Tipo di Post *</Label>
                        <div className="grid grid-cols-3 gap-3">
                          {POST_CATEGORIES.map((category) => {
                            const IconComponent = category.icon;
                            const isSelected = postCategory === category.value;
                            const hasSchemas = (POST_SCHEMAS[targetPlatform]?.[category.value]?.length || 0) > 0;
                            return (
                              <TooltipProvider key={category.value}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      onClick={() => {
                                        if (hasSchemas && postCategory !== category.value) {
                                          setPostCategory(category.value as "ads" | "valore" | "formazione" | "altri");
                                          setPostSchema("");
                                        }
                                      }}
                                      disabled={!hasSchemas}
                                      className={`p-3 rounded-lg border transition-all flex items-center gap-2 ${
                                        !hasSchemas
                                          ? "border-muted bg-muted/30 opacity-50 cursor-not-allowed"
                                          : isSelected
                                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                                            : "border-muted hover:border-indigo-200 dark:hover:border-indigo-800"
                                      }`}
                                    >
                                      <IconComponent className={`h-4 w-4 ${isSelected ? "text-indigo-600" : "text-muted-foreground"}`} />
                                      <div className="text-left">
                                        <span className={`text-sm font-medium block ${isSelected ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
                                          {category.label}
                                        </span>
                                        {!hasSchemas && (
                                          <span className="text-xs text-muted-foreground">Non disponibile</span>
                                        )}
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p className="text-xs">{category.description}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          })}
                        </div>
                      </div>

                      {/* Schema Selection */}
                      {availableSchemas.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <Label className="text-sm font-medium">Schema del Post *</Label>
                            {selectedSchemaDetails && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSchemaInfoDialog(true)}
                                className="h-7 px-2 text-xs text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                              >
                                <Eye className="h-3.5 w-3.5 mr-1" />
                                Anteprima Struttura
                              </Button>
                            )}
                          </div>
                          <div className="space-y-2">
                            {availableSchemas.map((schema) => {
                              const isSelected = postSchema === schema.value;
                              return (
                                <button
                                  key={schema.value}
                                  onClick={() => setPostSchema(schema.value)}
                                  className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                                    isSelected
                                      ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                                      : "border-muted hover:border-indigo-200 dark:hover:border-indigo-800"
                                  }`}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex-1">
                                      <p className={`font-medium text-sm ${isSelected ? "text-indigo-700 dark:text-indigo-300" : ""}`}>
                                        {schema.label}
                                      </p>
                                      <p className="text-xs text-muted-foreground mt-1">{schema.description}</p>
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {schema.structure.split("|").map((part, idx) => (
                                          <Badge key={idx} variant="outline" className="text-xs">
                                            {part}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <CheckCircle className="h-5 w-5 text-indigo-500 shrink-0" />
                                    )}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Character Limit Info */}
                      {currentPlatformInfo && (
                        <div className="bg-gradient-to-r from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 rounded-lg p-4 flex items-center gap-3">
                          <Type className="h-5 w-5 text-indigo-600" />
                          <div>
                            <p className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                              {dynamicPlatformLimits[targetPlatform].description}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              L'AI genererà contenuti rispettando questo limite
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* Step 3: Brand Voice & Context (optional) */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("context")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30 hover:from-teal-100 hover:to-cyan-100 dark:hover:from-teal-950/40 dark:hover:to-cyan-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center text-white font-bold text-sm">3</div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Brand Voice & Contesto</h3>
                      <p className="text-xs text-muted-foreground">Brand Voice obbligatorio, Knowledge Base opzionale</p>
                    </div>
                    {/* Check verde se Brand Voice è completo (Knowledge Base è opzionale) */}
                    {(useBrandVoice && Object.keys(brandVoiceData).length > 0) ? (
                      <CheckCircle className="h-5 w-5 text-green-500 ml-2" />
                    ) : useBrandVoice ? (
                      <div className="flex items-center gap-1 ml-2">
                        <AlertCircle className="h-4 w-4 text-amber-500" />
                        <span className="text-xs text-amber-600 dark:text-amber-400">Configura Brand Voice</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 ml-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <span className="text-xs text-red-600 dark:text-red-400">Brand Voice richiesto</span>
                      </div>
                    )}
                  </div>
                  <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("context") ? "rotate-180" : ""}`} />
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("context") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                    <CardContent className="pt-4 space-y-4">
                      {/* Toggle for Brand Voice */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-teal-500" />
                          <span className="font-medium text-sm">Usa Brand Voice</span>
                        </div>
                        <Switch checked={useBrandVoice} onCheckedChange={setUseBrandVoice} />
                      </div>
                      
                      {useBrandVoice && Object.keys(brandVoiceData).length === 0 && (
                        <div className="p-4 rounded-lg border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <div className="flex-1 space-y-2">
                              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                Brand Voice non configurato
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Per generare contenuti di qualità, configura prima il tuo Brand Voice con informazioni su chi sei, cosa fai e il tuo stile comunicativo.
                              </p>
                              <div className="flex flex-wrap gap-2 pt-1">
                                <a 
                                  href="/consultant/content-studio/brand"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors"
                                >
                                  <Palette className="h-3.5 w-3.5" />
                                  Vai a Brand Voice
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {useBrandVoice && Object.keys(brandVoiceData).length > 0 && (
                        <BrandVoiceSection
                          data={brandVoiceData}
                          onDataChange={setBrandVoiceData}
                          onSave={handleSaveBrandVoice}
                          isSaving={isSavingBrandVoice}
                          saveSuccess={saveSuccess}
                          compact={true}
                          showImportButton={true}
                          showSaveButton={true}
                          onImportClick={() => {
                            loadAvailableAgents();
                            setShowImportAgentDialog(true);
                          }}
                        />
                      )}
                      
                      {/* Toggle for Knowledge Base */}
                      <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-amber-500" />
                          <span className="font-medium text-sm">Usa Knowledge Base</span>
                        </div>
                        <Switch checked={useKnowledgeBase} onCheckedChange={setUseKnowledgeBase} />
                      </div>
                      
                      {useKnowledgeBase && (
                        <KnowledgeBaseSelector
                          selectedDocIds={selectedKbDocIds}
                          onSelectionChange={setSelectedKbDocIds}
                          tempFiles={tempFiles}
                          onTempFilesChange={setTempFiles}
                          maxTokens={50000}
                        />
                      )}
                    </CardContent>
                  </div>
                </div>
              </Card>

              {/* Step 4: Advanced Options (Collapsed by default) */}
              <Card className="overflow-hidden">
                <button
                  onClick={() => toggleSection("advanced")}
                  className="w-full px-6 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-gray-50 dark:from-slate-950/30 dark:to-gray-950/30 hover:from-slate-100 hover:to-gray-100 dark:hover:from-slate-950/40 dark:hover:to-gray-950/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-slate-500 flex items-center justify-center text-white font-bold text-sm">
                      <Cog className="h-4 w-4" />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-foreground">Opzioni Avanzate</h3>
                      <p className="text-xs text-muted-foreground">Livelli di consapevolezza e sofisticazione</p>
                    </div>
                    {/* Visual indicators for selected levels */}
                    {!expandedSections.has("advanced") && (
                      <div className="flex gap-2 ml-2">
                        <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                          {AWARENESS_LEVELS.find(l => l.value === awarenessLevel)?.label || awarenessLevel}
                        </Badge>
                        <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800">
                          Livello {sophisticationLevel.replace("level_", "")}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-green-500" />
                    <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedSections.has("advanced") ? "rotate-180" : ""}`} />
                  </div>
                </button>
                
                <div
                  className={`grid transition-all duration-300 ease-in-out ${expandedSections.has("advanced") ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                >
                  <div className="overflow-hidden">
                  <CardContent className="pt-4 space-y-5">
                    {/* AI Suggest Button */}
                    <div className="flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSuggestLevels}
                        disabled={isSuggestingLevels || (!topic && !targetAudience && !brandVoiceData)}
                        className="gap-2"
                      >
                        {isSuggestingLevels ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Wand2 className="h-4 w-4" />
                        )}
                        AI Suggerisci Livelli
                      </Button>
                    </div>

                    {/* Awareness Level - Compact Pills with Tooltips */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Livello di Consapevolezza</Label>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap gap-2">
                          {AWARENESS_LEVELS.map((level) => {
                            const isSelected = awarenessLevel === level.value;
                            const colorMap: Record<string, string> = {
                              red: isSelected ? "bg-red-500 text-white" : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                              orange: isSelected ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                              yellow: isSelected ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300",
                              blue: isSelected ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                              green: isSelected ? "bg-green-500 text-white" : "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
                            };
                            return (
                              <Tooltip key={level.value}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setAwarenessLevel(level.value as any)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${colorMap[level.color]} ${isSelected ? "shadow-md ring-2 ring-offset-2 ring-offset-background" : "hover:opacity-80"}`}
                                    style={{ ["--tw-ring-color" as any]: isSelected ? `var(--${level.color}-500)` : undefined }}
                                  >
                                    {level.label}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <p className="font-medium">{level.label}</p>
                                  <p className="text-muted-foreground text-xs">{level.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Sophistication Level - Compact Pills with Tooltips */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Sofisticazione Mercato (Schwartz)</Label>
                      <TooltipProvider delayDuration={200}>
                        <div className="flex flex-wrap gap-2">
                          {SOPHISTICATION_LEVELS.map((level) => {
                            const isSelected = sophisticationLevel === level.value;
                            const colorMap: Record<string, string> = {
                              emerald: isSelected ? "bg-emerald-500 text-white" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
                              blue: isSelected ? "bg-blue-500 text-white" : "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
                              purple: isSelected ? "bg-purple-500 text-white" : "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
                              orange: isSelected ? "bg-orange-500 text-white" : "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
                              pink: isSelected ? "bg-pink-500 text-white" : "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
                            };
                            return (
                              <Tooltip key={level.value}>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setSophisticationLevel(level.value as any)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${colorMap[level.color]} ${isSelected ? "shadow-md ring-2 ring-offset-2 ring-offset-background" : "hover:opacity-80"}`}
                                  >
                                    {level.label.split(" - ")[0]}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-xs">
                                  <p className="font-medium">{level.label}</p>
                                  <p className="text-muted-foreground text-xs">{level.description}</p>
                                </TooltipContent>
                              </Tooltip>
                            );
                          })}
                        </div>
                      </TooltipProvider>
                    </div>

                    {/* Additional Context */}
                    <div className="space-y-2">
                      <Label htmlFor="additionalContext" className="text-sm font-medium">Contesto Aggiuntivo (opzionale)</Label>
                      <Textarea
                        id="additionalContext"
                        placeholder="Stagionalità, eventi, informazioni extra sul tuo brand..."
                        value={additionalContext}
                        onChange={(e) => setAdditionalContext(e.target.value)}
                        rows={2}
                        className="resize-none"
                      />
                    </div>
                  </CardContent>
                  </div>
                </div>
              </Card>

              {/* Action Buttons - Sticky Bottom */}
              <Card className="sticky bottom-4 z-10 shadow-lg border-2 border-purple-200 dark:border-purple-800">
                <CardContent className="py-3 px-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Button
                      onClick={handleGenerateIdeas}
                      disabled={isGenerating || !objective || !useBrandVoice || Object.keys(brandVoiceData).length === 0}
                      size="lg"
                      className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                    >
                      {isGenerating ? (
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-5 w-5 mr-2" />
                      )}
                      {isGenerating ? "Generazione..." : "Genera Idee"}
                    </Button>
                    
                    <Button
                      onClick={() => setShowAutopilotSection(!showAutopilotSection)}
                      disabled={!objective || !useBrandVoice || Object.keys(brandVoiceData).length === 0 || !targetPlatform}
                      variant="outline"
                      size="lg"
                      className={`flex-1 sm:flex-none border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950 ${showAutopilotSection ? 'bg-orange-50 dark:bg-orange-950' : ''}`}
                    >
                      <Rocket className="h-5 w-5 mr-2 text-orange-500" />
                      Autopilot
                      {showAutopilotSection ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />}
                    </Button>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowSaveTemplateDialog(true)}
                        disabled={!useBrandVoice && !useKnowledgeBase}
                      >
                        <Save className="h-4 w-4 mr-1" />
                        Salva
                      </Button>
                      
                      {templates.length > 0 && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              <FolderOpen className="h-4 w-4 mr-1" />
                              Carica
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {templates.map((template: any) => (
                              <DropdownMenuItem key={template.id} onClick={() => handleLoadTemplate(template)}>
                                <FileText className="h-4 w-4 mr-2" />
                                {template.name}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {showAutopilotSection && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-6 p-6 border border-orange-200 dark:border-orange-800 rounded-xl bg-orange-50/50 dark:bg-orange-950/20"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Rocket className="h-5 w-5 text-orange-500" />
                    <h3 className="font-semibold text-lg">Content Autopilot Multi-Piattaforma</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Genera contenuti automaticamente per più giorni e piattaforme. Configura ogni piattaforma con impostazioni specifiche.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div>
                      <Label>Data Inizio</Label>
                      <Input 
                        type="date" 
                        value={autopilotStartDate} 
                        onChange={(e) => setAutopilotStartDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <Label>Data Fine</Label>
                      <Input 
                        type="date" 
                        value={autopilotEndDate} 
                        onChange={(e) => setAutopilotEndDate(e.target.value)}
                        min={autopilotStartDate || new Date().toISOString().split('T')[0]}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 mb-6 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="include-weekends"
                        checked={autopilotIncludeWeekends}
                        onCheckedChange={setAutopilotIncludeWeekends}
                      />
                      <Label htmlFor="include-weekends" className="text-sm cursor-pointer">
                        Includi Weekend
                      </Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="include-holidays"
                        checked={autopilotIncludeHolidays}
                        onCheckedChange={setAutopilotIncludeHolidays}
                      />
                      <Label htmlFor="include-holidays" className="text-sm cursor-pointer">
                        Includi Festività
                      </Label>
                    </div>
                  </div>

                  <div className="mb-6">
                    <Label className="text-base font-medium mb-3 block">Piattaforme</Label>
                    <div className="space-y-4">
                      {TARGET_PLATFORMS.map((platform) => {
                        const config = autopilotPlatforms[platform.value];
                        const isEnabled = config?.enabled || false;
                        const isExpanded = expandedAutopilotPlatforms.has(platform.value);
                        const PlatformIcon = platform.icon;
                        const availablePlatformSchemas = getAutopilotPlatformSchemas(platform.value, config?.postCategory || "ads");

                        return (
                          <div 
                            key={platform.value}
                            className={`border rounded-lg transition-all ${
                              isEnabled 
                                ? "border-orange-300 dark:border-orange-700 bg-white dark:bg-gray-900" 
                                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                            }`}
                          >
                            <div 
                              className="flex items-center justify-between p-4 cursor-pointer"
                              onClick={() => isEnabled && toggleAutopilotPlatformExpanded(platform.value)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${platform.color}`}>
                                  <PlatformIcon className="h-4 w-4 text-white" />
                                </div>
                                <div>
                                  <span className="font-medium">{platform.label}</span>
                                  {isEnabled && config && (
                                    <p className="text-xs text-muted-foreground">
                                      {config.postsPerDay} post/giorno • {POST_CATEGORIES.find(c => c.value === config.postCategory)?.label}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                {isEnabled && (
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleAutopilotPlatformExpanded(platform.value);
                                    }}
                                  >
                                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                  </Button>
                                )}
                                <Switch
                                  checked={isEnabled}
                                  onCheckedChange={(checked) => {
                                    updateAutopilotPlatform(platform.value, { enabled: checked });
                                    if (checked) {
                                      setExpandedAutopilotPlatforms(prev => new Set([...prev, platform.value]));
                                    }
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            </div>

                            {isEnabled && isExpanded && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="px-4 pb-4 border-t border-orange-100 dark:border-orange-900 pt-4"
                              >
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                  <div>
                                    <Label className="text-xs">Post al Giorno</Label>
                                    <Select 
                                      value={String(config.postsPerDay)} 
                                      onValueChange={(v) => updateAutopilotPlatform(platform.value, { postsPerDay: Number(v) })}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {[1, 2, 3, 4, 5].map(n => (
                                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs">Categoria</Label>
                                    <Select 
                                      value={config.postCategory} 
                                      onValueChange={(v: "ads" | "valore" | "formazione" | "altri") => {
                                        updateAutopilotPlatform(platform.value, { 
                                          postCategory: v,
                                          postSchema: "originale"
                                        });
                                      }}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {POST_CATEGORIES.map((cat) => (
                                          <SelectItem key={cat.value} value={cat.value}>
                                            <div className="flex items-center gap-2">
                                              <cat.icon className="h-3 w-3" />
                                              {cat.label}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs">Schema Post</Label>
                                    <Select 
                                      value={config.postSchema} 
                                      onValueChange={(v) => updateAutopilotPlatform(platform.value, { postSchema: v })}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {availablePlatformSchemas.map((schema) => (
                                          <SelectItem key={schema.value} value={schema.value}>
                                            {schema.label}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs">Tipo Media</Label>
                                    <Select 
                                      value={config.mediaType} 
                                      onValueChange={(v: "photo" | "video" | "carousel" | "text") => updateAutopilotPlatform(platform.value, { mediaType: v })}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="photo">
                                          <div className="flex items-center gap-2">
                                            <Camera className="h-3 w-3" />
                                            Foto
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="video">
                                          <div className="flex items-center gap-2">
                                            <Video className="h-3 w-3" />
                                            Video
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="carousel">
                                          <div className="flex items-center gap-2">
                                            <Palette className="h-3 w-3" />
                                            Carousel
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="text">
                                          <div className="flex items-center gap-2">
                                            <Type className="h-3 w-3" />
                                            Solo Testo
                                          </div>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs">Lunghezza Copy</Label>
                                    <Select 
                                      value={config.copyType} 
                                      onValueChange={(v: "short" | "long") => updateAutopilotPlatform(platform.value, { copyType: v })}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="short">
                                          <div className="flex items-center gap-2">
                                            <Scissors className="h-3 w-3" />
                                            Corto
                                          </div>
                                        </SelectItem>
                                        <SelectItem value="long">
                                          <div className="flex items-center gap-2">
                                            <AlignLeft className="h-3 w-3" />
                                            Lungo
                                          </div>
                                        </SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>

                                  <div>
                                    <Label className="text-xs">Stile Scrittura</Label>
                                    <Select 
                                      value={config.writingStyle} 
                                      onValueChange={(v) => updateAutopilotPlatform(platform.value, { writingStyle: v })}
                                    >
                                      <SelectTrigger className="mt-1">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {WRITING_STYLES.map((style) => (
                                          <SelectItem key={style.value} value={style.value}>
                                            <div className="flex items-center gap-2">
                                              <span>{style.icon}</span>
                                              {style.label}
                                            </div>
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Per-day configuration section */}
                  {autopilotStartDate && autopilotEndDate && Object.keys(autopilotPerDayConfig).length > 0 && (
                    <div className="border-t border-orange-200 dark:border-orange-800 pt-4 mb-6">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-5 w-5 text-orange-500" />
                          <Label className="text-base font-medium">Configurazione per Giorno</Label>
                          <Badge variant="outline" className="ml-2">
                            {Object.keys(autopilotPerDayConfig).length} giorni
                            {!autopilotIncludeWeekends && !autopilotIncludeHolidays && " (esclusi weekend e festività)"}
                            {!autopilotIncludeWeekends && autopilotIncludeHolidays && " (esclusi weekend)"}
                            {autopilotIncludeWeekends && !autopilotIncludeHolidays && " (escluse festività)"}
                          </Badge>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowPerDayConfig(!showPerDayConfig)}
                        >
                          {showPerDayConfig ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          {showPerDayConfig ? "Nascondi" : "Configura giorni"}
                        </Button>
                      </div>
                      
                      {showPerDayConfig && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="max-h-96 overflow-y-auto space-y-3 pr-2"
                        >
                          {Object.entries(autopilotPerDayConfig)
                            .sort(([a], [b]) => a.localeCompare(b))
                            .map(([date, platforms], dayIndex) => {
                              const isExpanded = expandedDays.has(date);
                              const totalConflicts = Object.values(platforms).reduce((sum, p) => sum + (p.hasExistingPosts || 0), 0);
                              const enabledPlatformsList = Object.keys(platforms);
                              
                              return (
                                <div 
                                  key={date}
                                  className="border rounded-lg border-orange-100 dark:border-orange-900 bg-white dark:bg-gray-900"
                                >
                                  <div 
                                    className="flex items-center justify-between p-3 cursor-pointer"
                                    onClick={() => toggleDayExpanded(date)}
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center text-sm font-medium text-orange-600 dark:text-orange-400">
                                        {dayIndex + 1}
                                      </div>
                                      <div>
                                        <span className="font-medium">{getWeekdayItalian(date)}</span>
                                        <span className="text-muted-foreground ml-2">{formatDateItalian(date)}</span>
                                      </div>
                                      <div className="flex items-center gap-1">
                                        {enabledPlatformsList.map(platform => {
                                          const platformInfo = TARGET_PLATFORMS.find(p => p.value === platform);
                                          if (!platformInfo) return null;
                                          const PlatformIcon = platformInfo.icon;
                                          return (
                                            <div key={platform} className={`p-1 rounded ${platformInfo.color}`}>
                                              <PlatformIcon className="h-3 w-3 text-white" />
                                            </div>
                                          );
                                        })}
                                      </div>
                                      {totalConflicts > 0 && (
                                        <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900 dark:text-amber-300 dark:border-amber-700">
                                          <AlertCircle className="h-3 w-3 mr-1" />
                                          {totalConflicts} post esistenti
                                        </Badge>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: "auto" }}
                                      exit={{ opacity: 0, height: 0 }}
                                      className="px-3 pb-3 border-t border-orange-100 dark:border-orange-900 pt-3 space-y-3"
                                    >
                                      {Object.entries(platforms).map(([platform, config]) => {
                                        const platformInfo = TARGET_PLATFORMS.find(p => p.value === platform);
                                        if (!platformInfo) return null;
                                        const PlatformIcon = platformInfo.icon;
                                        const postsPerDay = autopilotPlatforms[platform]?.postsPerDay || 1;
                                        const availableSchemas = getAutopilotPlatformSchemas(platform, config.postCategory);
                                        const hasConflict = (config.hasExistingPosts || 0) > 0;
                                        
                                        return (
                                          <div 
                                            key={platform}
                                            className={`p-3 rounded-lg border ${
                                              hasConflict
                                                ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20"
                                                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50"
                                            }`}
                                          >
                                            <div className="flex items-center gap-2 mb-2">
                                              <div className={`p-1.5 rounded ${platformInfo.color}`}>
                                                <PlatformIcon className="h-3.5 w-3.5 text-white" />
                                              </div>
                                              <span className="font-medium text-sm">{platformInfo.label}</span>
                                              <Badge variant="secondary" className="text-xs">
                                                {postsPerDay} post/giorno
                                              </Badge>
                                              {hasConflict && (
                                                <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                                  {config.hasExistingPosts} esistenti
                                                </Badge>
                                              )}
                                            </div>
                                            
                                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                                              <div>
                                                <Label className="text-xs">Categoria</Label>
                                                <Select 
                                                  value={config.postCategory} 
                                                  onValueChange={(v: "ads" | "valore" | "formazione" | "altri") => {
                                                    updateDayConfig(date, platform, { 
                                                      postCategory: v,
                                                      postSchema: "originale"
                                                    });
                                                  }}
                                                >
                                                  <SelectTrigger className="mt-1 h-7 text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {POST_CATEGORIES.map((cat) => (
                                                      <SelectItem key={cat.value} value={cat.value}>
                                                        <div className="flex items-center gap-1">
                                                          <cat.icon className="h-3 w-3" />
                                                          {cat.label}
                                                        </div>
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              
                                              <div>
                                                <Label className="text-xs">Schema</Label>
                                                <Select 
                                                  value={config.postSchema} 
                                                  onValueChange={(v) => updateDayConfig(date, platform, { postSchema: v })}
                                                >
                                                  <SelectTrigger className="mt-1 h-7 text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {availableSchemas.map((schema) => (
                                                      <SelectItem key={schema.value} value={schema.value}>
                                                        {schema.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              
                                              <div>
                                                <Label className="text-xs">Media</Label>
                                                <Select 
                                                  value={config.mediaType} 
                                                  onValueChange={(v: "photo" | "video" | "carousel" | "text") => updateDayConfig(date, platform, { mediaType: v })}
                                                >
                                                  <SelectTrigger className="mt-1 h-7 text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="photo">Foto</SelectItem>
                                                    <SelectItem value="video">Video</SelectItem>
                                                    <SelectItem value="carousel">Carousel</SelectItem>
                                                    <SelectItem value="text">Testo</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              
                                              <div>
                                                <Label className="text-xs">Copy</Label>
                                                <Select 
                                                  value={config.copyType} 
                                                  onValueChange={(v: "short" | "long") => updateDayConfig(date, platform, { copyType: v })}
                                                >
                                                  <SelectTrigger className="mt-1 h-7 text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    <SelectItem value="short">Corto</SelectItem>
                                                    <SelectItem value="long">Lungo</SelectItem>
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                              
                                              <div>
                                                <Label className="text-xs">Stile</Label>
                                                <Select 
                                                  value={config.writingStyle} 
                                                  onValueChange={(v) => updateDayConfig(date, platform, { writingStyle: v })}
                                                >
                                                  <SelectTrigger className="mt-1 h-7 text-xs">
                                                    <SelectValue />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {WRITING_STYLES.map((style) => (
                                                      <SelectItem key={style.value} value={style.value}>
                                                        {style.icon} {style.label}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                              </div>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </motion.div>
                                  )}
                                </div>
                              );
                            })}
                        </motion.div>
                      )}
                    </div>
                  )}

                  <div className="border-t border-orange-200 dark:border-orange-800 pt-4 mb-6">
                    <Label className="text-base font-medium mb-3 block">Opzioni Avanzate</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-100 dark:border-orange-900">
                        <div className="flex items-center gap-2">
                          <ImageIcon className="h-4 w-4 text-orange-500" />
                          <Label className="text-sm font-normal cursor-pointer">Genera Immagini AI</Label>
                        </div>
                        <Switch
                          checked={autopilotGenerateImages}
                          onCheckedChange={setAutopilotGenerateImages}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-100 dark:border-orange-900">
                        <div className="flex items-center gap-2">
                          <ExternalLink className="h-4 w-4 text-orange-500" />
                          <Label className="text-sm font-normal cursor-pointer">Pubblica su Publer</Label>
                        </div>
                        <Switch
                          checked={autopilotPublishToPubler}
                          onCheckedChange={(checked) => {
                            setAutopilotPublishToPubler(checked);
                            if (checked) {
                              setAutopilotReviewMode(false);
                            }
                          }}
                        />
                      </div>
                      <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-100 dark:border-orange-900">
                        <div className="flex items-center gap-2">
                          <Eye className="h-4 w-4 text-orange-500" />
                          <Label className="text-sm font-normal cursor-pointer">Modalità Review</Label>
                        </div>
                        <Switch
                          checked={autopilotReviewMode}
                          onCheckedChange={(checked) => {
                            setAutopilotReviewMode(checked);
                            if (checked) {
                              setAutopilotPublishToPubler(false);
                            }
                          }}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {autopilotReviewMode 
                        ? "I contenuti saranno generati in bozza per la tua revisione." 
                        : autopilotPublishToPubler
                          ? "I contenuti saranno pubblicati automaticamente su Publer."
                          : "I contenuti saranno generati e pronti per la pubblicazione."}
                    </p>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <Button 
                      onClick={handleAutopilotGenerate}
                      disabled={!autopilotStartDate || !autopilotEndDate || isAutopilotGenerating || Object.values(autopilotPlatforms).filter(p => p.enabled).length === 0}
                      className="bg-orange-500 hover:bg-orange-600"
                    >
                      {isAutopilotGenerating ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generazione in corso...
                        </>
                      ) : (
                        <>
                          <Rocket className="h-4 w-4 mr-2" />
                          Avvia Autopilot ({Object.values(autopilotPlatforms).filter(p => p.enabled).length} piattaforme)
                        </>
                      )}
                    </Button>
                    
                    {autopilotProgress && (
                      <div className="flex-1">
                        <Progress value={(autopilotProgress.completed / autopilotProgress.total) * 100} />
                        <p className="text-xs text-muted-foreground mt-1">
                          {autopilotProgress.currentDate && autopilotProgress.totalDays ? (
                            <>
                              Generando giorno {autopilotProgress.currentDayIndex}/{autopilotProgress.totalDays}: {formatDateItalian(autopilotProgress.currentDate)}
                              {autopilotProgress.currentPlatform && <span className="ml-2">({autopilotProgress.currentPlatform})</span>}
                            </>
                          ) : (
                            <>{autopilotProgress.completed}/{autopilotProgress.total} post generati</>
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                  
                  {/* Pannello Progresso Dettagliato */}
                  {(isAutopilotGenerating || autopilotGeneratedPosts.length > 0) && (
                    <div className="mt-4 border border-orange-200 dark:border-orange-800 rounded-lg bg-white dark:bg-gray-900 overflow-hidden">
                      <div className="p-3 bg-orange-50 dark:bg-orange-950/30 border-b border-orange-200 dark:border-orange-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-orange-500" />
                          <span className="font-medium text-sm">Dettaglio Generazione</span>
                          <Badge variant="outline" className="text-xs">
                            {autopilotGeneratedPosts.length} post
                          </Badge>
                        </div>
                        {!isAutopilotGenerating && autopilotGeneratedPosts.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAutopilotGeneratedPosts([])}
                            className="h-6 text-xs"
                          >
                            Chiudi
                          </Button>
                        )}
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {autopilotGeneratedPosts.length === 0 && isAutopilotGenerating && (
                          <div className="p-4 text-center text-muted-foreground text-sm">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                            Generazione in corso...
                          </div>
                        )}
                        {autopilotGeneratedPosts.map((post, idx) => {
                          const platformInfo = TARGET_PLATFORMS.find(p => p.value === post.platform);
                          const PlatformIcon = platformInfo?.icon || Instagram;
                          const charPercentage = Math.round((post.charCount / post.charLimit) * 100);
                          const isOverLimit = post.charCount > post.charLimit;
                          
                          return (
                            <div
                              key={`${post.id}-${idx}`}
                              className="p-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                            >
                              <div className="flex items-start gap-3">
                                <div className="flex items-center gap-2 shrink-0">
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  <div className={`p-1 rounded ${platformInfo?.color || "bg-gray-500"}`}>
                                    <PlatformIcon className="h-3 w-3 text-white" />
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{post.title}</p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1">
                                    <span className="text-xs text-muted-foreground">
                                      {formatDateItalian(post.date)}
                                    </span>
                                    <Badge 
                                      variant="outline" 
                                      className={`text-xs ${
                                        isOverLimit 
                                          ? "bg-red-50 text-red-600 border-red-200 dark:bg-red-950 dark:text-red-400" 
                                          : charPercentage > 90 
                                            ? "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950 dark:text-amber-400"
                                            : "bg-green-50 text-green-600 border-green-200 dark:bg-green-950 dark:text-green-400"
                                      }`}
                                    >
                                      {post.charCount}/{post.charLimit} caratteri
                                    </Badge>
                                    {post.retries > 0 && (
                                      <Badge variant="outline" className="text-xs bg-orange-50 text-orange-600 border-orange-200">
                                        {post.retries} retry
                                      </Badge>
                                    )}
                                    {post.imageGenerated && (
                                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-600 border-purple-200">
                                        <ImageIcon className="h-3 w-3 mr-1" />
                                        Immagine
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-500" />
                  Le Tue Idee ({filteredAndSortedIdeas.length})
                </h2>
                
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Ordina per" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="score-desc">Score (alto-basso)</SelectItem>
                      <SelectItem value="date-desc">Data (recente)</SelectItem>
                      <SelectItem value="content-type">Tipo contenuto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                {STATUS_FILTERS.map((filter) => {
                  const FilterIcon = filter.icon;
                  const isActive = statusFilter === filter.value;
                  const count = filter.value === "all" 
                    ? ideas.length 
                    : filter.value === "developed"
                      ? ideas.filter(i => i.status === "developed" || i.developedPostId).length
                      : ideas.filter(i => i.status === filter.value && !i.developedPostId).length;
                  return (
                    <button
                      key={filter.value}
                      onClick={() => setStatusFilter(filter.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                        isActive
                          ? filter.value === "developed"
                            ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                            : filter.value === "in_progress"
                              ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md"
                              : filter.value === "archived"
                                ? "bg-gradient-to-r from-gray-500 to-gray-600 text-white shadow-md"
                                : filter.value === "new"
                                  ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                                  : "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                          : "bg-muted hover:bg-muted/80 text-muted-foreground"
                      }`}
                    >
                      <FilterIcon className="h-4 w-4" />
                      {filter.label}
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-white/20" : "bg-muted-foreground/20"}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
                
                {/* Sync button for ideas that have posts but aren't marked as developed */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => syncDevelopedMutation.mutate()}
                  disabled={syncDevelopedMutation.isPending}
                  className="ml-2 h-9 text-xs"
                  title="Sincronizza stato idee con post esistenti"
                >
                  {syncDevelopedMutation.isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Sincronizza stato
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-xs text-muted-foreground self-center mr-2">Tipo:</span>
                <button
                  onClick={() => toggleFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeFilters.has("all")
                      ? "bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  Tutti
                </button>
                <button
                  onClick={() => toggleFilter("video")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("video")
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Video className="h-3 w-3" />
                  Video
                </button>
                <button
                  onClick={() => toggleFilter("photo")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("photo")
                      ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Camera className="h-3 w-3" />
                  Foto
                </button>
                <button
                  onClick={() => toggleFilter("long")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("long")
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <AlignLeft className="h-3 w-3" />
                  Lungo
                </button>
                <button
                  onClick={() => toggleFilter("short")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    activeFilters.has("short")
                      ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <FileTextIcon className="h-3 w-3" />
                  Corto
                </button>
                
                <span className="text-xs text-muted-foreground self-center mx-2">|</span>
                <span className="text-xs text-muted-foreground self-center mr-2">Piattaforma:</span>
                <button
                  onClick={() => setFilterPlatform("all")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    filterPlatform === "all"
                      ? "bg-gradient-to-r from-gray-600 to-gray-700 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  Tutte
                </button>
                <button
                  onClick={() => setFilterPlatform("instagram")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    filterPlatform === "instagram"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Instagram className="h-3 w-3" />
                  Instagram
                </button>
                <button
                  onClick={() => setFilterPlatform("x")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    filterPlatform === "x"
                      ? "bg-gray-800 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Twitter className="h-3 w-3" />
                  X
                </button>
                <button
                  onClick={() => setFilterPlatform("linkedin")}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 ${
                    filterPlatform === "linkedin"
                      ? "bg-blue-700 text-white shadow-md"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  <Linkedin className="h-3 w-3" />
                  LinkedIn
                </button>
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-5 space-y-4">
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <div className="flex gap-2">
                          <Skeleton className="h-9 flex-1" />
                          <Skeleton className="h-9 flex-1" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : filteredAndSortedIdeas.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredAndSortedIdeas.map((idea) => {
                    const statusInfo = getStatusInfo(idea.status, idea.developedPostId);
                    const StatusIcon = statusInfo.icon;
                    const isDeveloped = idea.developedPostId || idea.status === "developed";
                    const isArchived = idea.status === "archived";
                    
                    return (
                    <motion.div
                      key={idea.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={{ scale: 1.02, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Card className={`h-full overflow-hidden hover:shadow-lg transition-shadow duration-300 group ${statusInfo.cardClass} ${isArchived ? "opacity-70" : ""}`}>
                        <CardContent className="p-5 flex flex-col h-full">
                          <div className="flex items-center justify-between gap-2 mb-3">
                            <div className="flex flex-wrap gap-2">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </span>
                              {idea.mediaType && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  idea.mediaType === "video"
                                    ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                                    : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                                }`}>
                                  {idea.mediaType === "video" ? (
                                    <><Video className="h-3 w-3" /> Video</>
                                  ) : (
                                    <><Camera className="h-3 w-3" /> Foto</>
                                  )}
                                </span>
                              )}
                              {idea.copyType && (
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                                  idea.copyType === "long"
                                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                    : "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                                }`}>
                                  {idea.copyType === "long" ? (
                                    <><AlignLeft className="h-3 w-3" /> Lungo</>
                                  ) : (
                                    <><FileTextIcon className="h-3 w-3" /> Corto</>
                                  )}
                                </span>
                              )}
                            </div>
                            
                            <div className={`flex items-center justify-center w-10 h-10 rounded-full text-sm font-bold ${
                              (idea.aiScore || 0) >= 85 
                                ? "bg-gradient-to-br from-green-400 to-green-600 text-white" 
                                : (idea.aiScore || 0) >= 70 
                                  ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" 
                                  : (idea.aiScore || 0) > 0
                                    ? "bg-gradient-to-br from-red-400 to-red-600 text-white"
                                    : "bg-gradient-to-br from-slate-300 to-slate-400 text-white"
                            }`}>
                              {idea.aiScore || "-"}
                            </div>
                          </div>

                          <h3 className="font-semibold text-base mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                            {idea.title}
                          </h3>

                          {idea.lengthWarning && (
                            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 px-2 py-1 rounded flex items-center gap-1 mb-3">
                              <AlertTriangle className="h-3 w-3" />
                              {idea.lengthWarning}
                            </div>
                          )}

                          {idea.hook && (
                            <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-3 rounded-lg mb-3 flex-grow">
                              <p className="text-xs text-purple-600 dark:text-purple-400 font-medium mb-1 flex items-center gap-1">
                                <Sparkles className="h-3 w-3" />
                                Hook
                              </p>
                              <p className="text-sm italic text-muted-foreground line-clamp-3">"{idea.hook}"</p>
                            </div>
                          )}
                          
                          {!idea.hook && idea.description && (
                            <p className="text-sm text-muted-foreground line-clamp-3 mb-3 flex-grow">
                              {idea.description}
                            </p>
                          )}

                          {isDeveloped && idea.developedPostId && (
                            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-2 mb-3">
                              <button
                                onClick={() => handleGoToPost(idea.developedPostId!)}
                                className="w-full flex items-center justify-center gap-2 text-green-600 dark:text-green-400 font-medium text-sm hover:text-green-700 dark:hover:text-green-300 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Vai al Post
                              </button>
                            </div>
                          )}

                          <div className="flex gap-2 mt-auto pt-3 border-t">
                            {isDeveloped ? (
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="flex-1 border-green-300 text-green-600 hover:bg-green-50"
                                onClick={() => idea.developedPostId && handleGoToPost(idea.developedPostId)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Post Creato
                              </Button>
                            ) : (
                              <Button 
                                size="sm" 
                                className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                                onClick={() => handleDevelopPost(idea)}
                              >
                                <Zap className="h-4 w-4 mr-1" />
                                Sviluppa
                              </Button>
                            )}
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="flex-1"
                              onClick={() => setViewingIdea(idea)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Visualizza
                            </Button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "new")} disabled={idea.status === "new"}>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Segna come Nuova
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "in_progress")} disabled={idea.status === "in_progress"}>
                                  <Clock className="h-4 w-4 mr-2" />
                                  In Lavorazione
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStatusChange(idea.id, "archived")} disabled={idea.status === "archived"}>
                                  <Archive className="h-4 w-4 mr-2" />
                                  Archivia
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <ImageIcon className="h-4 w-4 mr-2" />
                                  Genera Immagine
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  <Calendar className="h-4 w-4 mr-2" />
                                  Aggiungi a Calendario
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  className="text-destructive"
                                  onClick={() => deleteIdeaMutation.mutate(idea.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Elimina
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                  })}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="font-semibold mb-2">Nessuna idea salvata</h3>
                    <p className="text-muted-foreground mb-4">
                      Genera nuove idee con l'AI o creane una manualmente
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showSaveTemplateDialog} onOpenChange={setShowSaveTemplateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Save className="h-5 w-5 text-purple-500" />
              Salva Template
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="template-name">Nome Template</Label>
              <Input
                id="template-name"
                placeholder="Es: Template B2B SaaS..."
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
              />
            </div>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>Verranno salvati:</p>
              <ul className="list-disc list-inside text-xs">
                {topic && <li>Topic: {topic.slice(0, 50)}...</li>}
                {targetAudience && <li>Target: {targetAudience.slice(0, 50)}...</li>}
                {objective && <li>Obiettivo: {objective}</li>}
              </ul>
            </div>
            <Button onClick={handleSaveTemplate} disabled={!templateName.trim()} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Salva Template
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Schema Info Dialog */}
      <Dialog open={showSchemaInfoDialog} onOpenChange={setShowSchemaInfoDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-indigo-500" />
              Struttura Schema: {selectedSchemaDetails?.label}
            </DialogTitle>
          </DialogHeader>
          {selectedSchemaDetails && (
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">{selectedSchemaDetails.description}</p>
              <div className="space-y-3">
                {selectedSchemaDetails.structure.split("|").map((section, idx) => {
                  const instruction = getSectionGuidelineDisplay(section);
                  return (
                    <div key={idx} className="p-3 rounded-lg border bg-muted/30">
                      <div className="flex items-start gap-3">
                        <Badge variant="secondary" className="shrink-0 mt-0.5">
                          {idx + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-foreground">{section}</p>
                          <p className="text-xs text-muted-foreground mt-1">{instruction}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  L'AI seguirà questa struttura esattamente nell'ordine indicato, applicando le istruzioni specifiche per ogni sezione.
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showLevelsSuggestionDialog} onOpenChange={setShowLevelsSuggestionDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-purple-500" />
              Livelli Suggeriti dall'AI
            </DialogTitle>
          </DialogHeader>
          {levelsSuggestion && (
            <div className="space-y-6 py-4">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-orange-500" />
                  <h4 className="font-semibold">Livello di Consapevolezza</h4>
                </div>
                <div className="bg-orange-50 dark:bg-orange-950/30 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
                  <p className="font-medium text-orange-700 dark:text-orange-300 mb-2">
                    {AWARENESS_LEVELS.find(l => l.value === levelsSuggestion.awarenessLevel)?.label || levelsSuggestion.awarenessLevel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {levelsSuggestion.awarenessReason}
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  <h4 className="font-semibold">Livello di Sofisticazione</h4>
                </div>
                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <p className="font-medium text-purple-700 dark:text-purple-300 mb-2">
                    {SOPHISTICATION_LEVELS.find(l => l.value === levelsSuggestion.sophisticationLevel)?.label || levelsSuggestion.sophisticationLevel}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {levelsSuggestion.sophisticationReason}
                  </p>
                </div>
              </div>

              <Button 
                onClick={() => setShowLevelsSuggestionDialog(false)} 
                className="w-full"
              >
                Ho capito, grazie!
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showGeneratedDialog} onOpenChange={(open) => {
        setShowGeneratedDialog(open);
        if (!open) setSavedIdeaIndexes(new Set()); // Reset when closing
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-4 border-b">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Sparkles className="h-5 w-5 text-purple-500" />
              Idee Generate
              <Badge variant="secondary" className="ml-2">{generatedIdeas.length}</Badge>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {generatedIdeas.map((idea, index) => {
              const copyLength = idea.copyContent?.length || 0;
              const ideaPlatform = idea.targetPlatform || targetPlatform || 'instagram';
              const charLimit = ideaPlatform === 'x' 
                ? dynamicPlatformLimits.x.tweet 
                : (ideaPlatform === 'linkedin' ? dynamicPlatformLimits.linkedin.post : dynamicPlatformLimits.instagram.caption);
              const charPercentage = Math.min((copyLength / charLimit) * 100, 100);
              const isOverLimit = copyLength > charLimit;
              
              return (
                <Card key={index} className="border shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-0">
                    {/* Compact Header */}
                    <div className="p-4 border-b bg-muted/30">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            {(idea.aiScore || idea.score) && (
                              <Badge className={`${getScoreColor(idea.aiScore || idea.score)} text-xs`}>
                                {idea.aiScore || idea.score}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs">
                              {idea.mediaType === "video" ? <Video className="h-3 w-3 mr-1" /> : <Camera className="h-3 w-3 mr-1" />}
                              {idea.mediaType === "video" ? "Video" : "Foto"}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {idea.copyType === "long" ? "Lungo" : "Corto"}
                            </Badge>
                            {copyLength > 0 && (
                              <Badge variant={isOverLimit ? "destructive" : "secondary"} className="text-xs font-mono">
                                {copyLength.toLocaleString()}/{charLimit.toLocaleString()} char
                              </Badge>
                            )}
                            {isOverLimit && idea.copyContent && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => shortenCopyMutation.mutate({
                                  originalCopy: idea.copyContent!,
                                  targetLimit: charLimit,
                                  platform: ideaPlatform,
                                  index,
                                })}
                                disabled={shorteningIndexes.has(index)}
                                className="h-6 px-2 text-xs border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
                              >
                                {shorteningIndexes.has(index) ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Scissors className="h-3 w-3" />
                                )}
                                <span className="ml-1">Accorcia</span>
                              </Button>
                            )}
                          </div>
                          <h4 className="font-semibold text-base leading-tight">{idea.title}</h4>
                          {idea.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{idea.description}</p>
                          )}
                        </div>
                        <Button
                          size="default"
                          onClick={() => handleSaveGeneratedIdea(idea, index)}
                          disabled={createIdeaMutation.isPending || savedIdeaIndexes.has(index)}
                          className={`shrink-0 font-semibold px-5 py-2 ${
                            savedIdeaIndexes.has(index) 
                              ? "bg-green-500 hover:bg-green-500 text-white" 
                              : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all"
                          }`}
                        >
                          {createIdeaMutation.isPending && !savedIdeaIndexes.has(index) ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : savedIdeaIndexes.has(index) ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <Bookmark className="h-5 w-5" />
                          )}
                          <span className="ml-2">{savedIdeaIndexes.has(index) ? "Salvata" : "Salva"}</span>
                        </Button>
                      </div>
                      
                      {/* Hook */}
                      {(idea.suggestedHook || idea.hook) && (
                        <div className="mt-3 flex items-start gap-2 text-sm">
                          <span className="font-medium text-purple-600 dark:text-purple-400 shrink-0">Hook:</span>
                          <span className="text-muted-foreground italic">"{idea.suggestedHook || idea.hook}"</span>
                        </div>
                      )}
                    </div>

                    {/* Content Grid - 2 columns for photo */}
                    <div className={`p-4 ${idea.mediaType === "photo" && (idea.imageDescription || idea.imageOverlayText) ? "grid md:grid-cols-2 gap-4" : ""}`}>
                      
                      {/* Left Column: Image Info */}
                      {idea.mediaType === "photo" && (idea.imageDescription || idea.imageOverlayText) && (
                        <div className="space-y-3">
                          <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                            <Camera className="h-4 w-4" />
                            Immagine
                          </h5>
                          {idea.imageDescription && (
                            <div className="text-sm p-3 rounded-lg bg-muted/50 border">
                              <p className="leading-relaxed">{idea.imageDescription}</p>
                            </div>
                          )}
                          {idea.imageOverlayText && (
                            <div className="bg-gray-900 text-white p-3 rounded-lg text-center">
                              <span className="text-xs text-gray-400 block mb-1">Testo Overlay</span>
                              <span className="font-semibold">"{idea.imageOverlayText}"</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Video Script */}
                      {idea.mediaType === "video" && idea.videoScript && (
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                            <Video className="h-4 w-4" />
                            Script Video
                          </h5>
                          <div className="text-sm p-3 rounded-lg bg-muted/50 border max-h-48 overflow-y-auto">
                            <p className="whitespace-pre-wrap leading-relaxed">{idea.videoScript}</p>
                          </div>
                        </div>
                      )}

                      {/* Right Column (or full width): Copy */}
                      {idea.copyContent && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <h5 className="text-sm font-medium flex items-center gap-1.5 text-muted-foreground">
                              <AlignLeft className="h-4 w-4" />
                              {idea.copyType === "long" ? "Copy Narrativo" : "Copy Diretto"}
                            </h5>
                            {/* Character progress bar */}
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all ${isOverLimit ? "bg-red-500" : charPercentage > 90 ? "bg-yellow-500" : "bg-green-500"}`}
                                  style={{ width: `${charPercentage}%` }}
                                />
                              </div>
                            </div>
                          </div>
                          <div className="text-sm p-3 rounded-lg bg-muted/50 border max-h-64 overflow-y-auto">
                            <p className="whitespace-pre-wrap leading-relaxed">{idea.copyContent}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Footer with CTA */}
                    {idea.suggestedCta && (
                      <div className="px-4 pb-3">
                        <p className="text-xs text-muted-foreground">
                          <span className="font-medium">CTA:</span> {idea.suggestedCta}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewingIdea} onOpenChange={(open) => !open && setViewingIdea(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-purple-500" />
              Dettagli Idea
            </DialogTitle>
          </DialogHeader>
          {viewingIdea && (() => {
            const viewStatusInfo = getStatusInfo(viewingIdea.status, viewingIdea.developedPostId);
            const ViewStatusIcon = viewStatusInfo.icon;
            const isViewDeveloped = viewingIdea.developedPostId || viewingIdea.status === "developed";
            
            return (
            <div className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${viewStatusInfo.color}`}>
                  <ViewStatusIcon className="h-4 w-4" />
                  {viewStatusInfo.label}
                </span>
                {viewingIdea.mediaType && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    viewingIdea.mediaType === "video"
                      ? "bg-gradient-to-r from-blue-500 to-cyan-500 text-white"
                      : "bg-gradient-to-r from-green-500 to-emerald-500 text-white"
                  }`}>
                    {viewingIdea.mediaType === "video" ? (
                      <><Video className="h-4 w-4" /> Video</>
                    ) : (
                      <><Camera className="h-4 w-4" /> Foto</>
                    )}
                  </span>
                )}
                {viewingIdea.copyType && (
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${
                    viewingIdea.copyType === "long"
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                      : "bg-gradient-to-r from-orange-500 to-amber-500 text-white"
                  }`}>
                    {viewingIdea.copyType === "long" ? (
                      <><AlignLeft className="h-4 w-4" /> Copy Lungo</>
                    ) : (
                      <><FileTextIcon className="h-4 w-4" /> Copy Corto</>
                    )}
                  </span>
                )}
                <div className={`flex items-center justify-center px-3 py-1.5 rounded-full text-sm font-bold ${
                  (viewingIdea.score || 0) >= 85 
                    ? "bg-gradient-to-br from-green-400 to-green-600 text-white" 
                    : (viewingIdea.score || 0) >= 70 
                      ? "bg-gradient-to-br from-amber-400 to-amber-600 text-white" 
                      : "bg-gradient-to-br from-red-400 to-red-600 text-white"
                }`}>
                  Score: {viewingIdea.score || 0}
                </div>
              </div>

              {isViewDeveloped && viewingIdea.developedPostId && (
                <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-medium">Questa idea è stata sviluppata in un post</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-green-300 text-green-600 hover:bg-green-100"
                      onClick={() => {
                        handleGoToPost(viewingIdea.developedPostId!);
                        setViewingIdea(null);
                      }}
                    >
                      <ExternalLink className="h-4 w-4 mr-1" />
                      Vai al Post
                    </Button>
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xl font-bold mb-2">{viewingIdea.title}</h3>
                {viewingIdea.description && (
                  <p className="text-muted-foreground">{viewingIdea.description}</p>
                )}
              </div>

              {viewingIdea.hook && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30 p-4 rounded-xl">
                  <p className="text-sm text-purple-600 dark:text-purple-400 font-medium mb-2 flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    Hook
                  </p>
                  <p className="text-lg italic">"{viewingIdea.hook}"</p>
                </div>
              )}

              {viewingIdea.mediaType === "video" && viewingIdea.videoScript && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Video className="h-5 w-5" />
                    <span className="font-semibold">Script Video</span>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
                    <p className="whitespace-pre-wrap leading-relaxed">{viewingIdea.videoScript}</p>
                  </div>
                </div>
              )}

              {viewingIdea.mediaType === "photo" && (viewingIdea.imageDescription || viewingIdea.imageOverlayText) && (
                <div className="space-y-4">
                  {viewingIdea.imageDescription && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Camera className="h-5 w-5" />
                        <span className="font-semibold">Descrizione Immagine</span>
                      </div>
                      <div className="bg-green-50 dark:bg-green-950/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
                        <p>{viewingIdea.imageDescription}</p>
                      </div>
                    </div>
                  )}
                  {viewingIdea.imageOverlayText && (
                    <div className="space-y-2">
                      <span className="font-semibold text-green-600 dark:text-green-400">Testo Overlay:</span>
                      <div className="bg-black text-white p-4 rounded-xl text-center font-bold text-lg">
                        "{viewingIdea.imageOverlayText}"
                      </div>
                    </div>
                  )}
                </div>
              )}

              {viewingIdea.copyContent && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                    {viewingIdea.copyType === "long" ? <AlignLeft className="h-5 w-5" /> : <FileTextIcon className="h-5 w-5" />}
                    <span className="font-semibold">
                      {viewingIdea.copyType === "long" ? "Copy Lungo" : "Copy Corto"}
                    </span>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
                    <p className="whitespace-pre-wrap leading-relaxed">{viewingIdea.copyContent}</p>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                {isViewDeveloped ? (
                  <Button 
                    variant="outline"
                    className="flex-1 border-green-300 text-green-600 hover:bg-green-50"
                    onClick={() => {
                      if (viewingIdea.developedPostId) {
                        handleGoToPost(viewingIdea.developedPostId);
                      }
                      setViewingIdea(null);
                    }}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Vai al Post
                  </Button>
                ) : (
                  <Button 
                    className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                    onClick={() => {
                      handleDevelopPost(viewingIdea);
                      setViewingIdea(null);
                    }}
                  >
                    <Zap className="h-4 w-4 mr-2" />
                    Sviluppa Post
                  </Button>
                )}
                <Button 
                  variant="destructive" 
                  onClick={() => {
                    deleteIdeaMutation.mutate(viewingIdea.id);
                    setViewingIdea(null);
                  }}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Elimina
                </Button>
              </div>
            </div>
          );
          })()}
        </DialogContent>
      </Dialog>

      {/* Import Brand Voice from Agent Dialog */}
      <Dialog open={showImportAgentDialog} onOpenChange={setShowImportAgentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Importa Brand Voice da Agente
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Seleziona un agente WhatsApp per importare i dati del Brand Voice
          </p>
          <div className="space-y-4 py-4">
            {availableAgents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p className="text-sm">Nessun agente WhatsApp configurato.</p>
                <p className="text-xs mt-2">Configura prima un agente nella sezione WhatsApp.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {availableAgents.map((agent: any) => (
                  <div
                    key={agent.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAgentId === agent.id
                        ? "border-primary bg-primary/5"
                        : "hover:border-muted-foreground/50"
                    }`}
                    onClick={() => setSelectedAgentId(agent.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        checked={selectedAgentId === agent.id}
                        onChange={() => setSelectedAgentId(agent.id)}
                        className="h-4 w-4 text-primary"
                      />
                      <div>
                        <p className="font-medium text-sm">{agent.agentName || agent.businessName || "Agente senza nome"}</p>
                        <p className="text-xs text-muted-foreground">
                          {agent.businessName || agent.agentType || "Nessuna descrizione"}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setShowImportAgentDialog(false)}>
                Annulla
              </Button>
              <Button
                onClick={handleImportFromAgent}
                disabled={!selectedAgentId || isImportingBrandVoice}
              >
                {isImportingBrandVoice ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importazione...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Importa
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
