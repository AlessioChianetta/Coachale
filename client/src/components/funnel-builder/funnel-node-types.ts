import {
  Facebook,
  Search,
  Instagram,
  Music2,
  Users,
  Leaf,
  Globe,
  FileText,
  Magnet,
  Webhook,
  FileSpreadsheet,
  Target,
  Bot,
  MessageCircle,
  Mail,
  Phone,
  MessageSquare,
  Send,
  Calendar,
  PhoneCall,
  PhoneForwarded,
  CheckCircle,
  CreditCard,
  UserPlus,
  Briefcase,
  RefreshCw,
  Puzzle,
  Flame,
  Route,
  type LucideIcon,
} from "lucide-react";

export interface AcademyLink {
  lessonId: string;
  title: string;
  moduleTitle: string;
  moduleEmoji: string;
  configLink: string;
  videoCount: number;
}

export type NodeCategory =
  | "sorgenti"
  | "cattura"
  | "gestione"
  | "comunicazione"
  | "conversione"
  | "delivery"
  | "custom";

export type EntityType =
  | "posts"
  | "referral_config"
  | "optin_config"
  | "lead_magnet"
  | "hunter_searches"
  | "ai_employees"
  | "agents"
  | "email_accounts"
  | "voice_numbers"
  | "booking"
  | "services"
  | "campaigns"
  | "nurturing_config"
  | "email_journey_config"
  | "academy_lessons";

export interface FunnelNodeType {
  type: string;
  label: string;
  category: NodeCategory;
  icon: LucideIcon;
  description: string;
}

export type NodeStatus = "active" | "draft" | "paused" | "disabled";

export const NODE_STATUS_CONFIG: Record<NodeStatus, { label: string; color: string; dotColor: string }> = {
  active: { label: "Attivo", color: "text-green-600 dark:text-green-400", dotColor: "bg-green-500" },
  draft: { label: "Bozza", color: "text-yellow-600 dark:text-yellow-400", dotColor: "bg-yellow-500" },
  paused: { label: "In Pausa", color: "text-orange-600 dark:text-orange-400", dotColor: "bg-orange-500" },
  disabled: { label: "Disabilitato", color: "text-gray-500 dark:text-gray-400", dotColor: "bg-gray-400" },
};

export interface FunnelNodeData {
  type: string;
  label: string;
  subtitle?: string;
  notes?: string;
  conversionRate?: number;
  category: NodeCategory;
  linkedEntity?: LinkedEntity | null;
  linkedEntities?: LinkedEntity[];
  status?: NodeStatus;
  color?: string;
  tags?: string[];
  delayMinutes?: number;
  conditionLabel?: string;
  priority?: "low" | "medium" | "high";
  academyLessons?: AcademyLink[];
}

export function getLinkedEntities(data: FunnelNodeData): LinkedEntity[] {
  const entities: LinkedEntity[] = [];
  if (data.linkedEntities && data.linkedEntities.length > 0) {
    entities.push(...data.linkedEntities);
  } else if (data.linkedEntity) {
    entities.push(data.linkedEntity);
  }
  if (data.academyLessons && data.academyLessons.length > 0) {
    for (const al of data.academyLessons) {
      entities.push({
        entityType: "academy_lessons",
        entityId: al.lessonId,
        name: al.title,
        extra: { moduleTitle: al.moduleTitle, moduleEmoji: al.moduleEmoji, configLink: al.configLink, videoCount: al.videoCount },
      });
    }
  }
  return entities;
}

export interface LinkedEntity {
  entityType: EntityType;
  entityId: string;
  name: string;
  imageUrl?: string | null;
  platform?: string;
  status?: string;
  extra?: Record<string, any>;
}

export const CATEGORY_COLORS: Record<NodeCategory, { bg: string; border: string; text: string; accent: string }> = {
  sorgenti: { bg: "bg-blue-50 dark:bg-blue-950/40", border: "border-blue-400 dark:border-blue-500", text: "text-blue-700 dark:text-blue-300", accent: "#3b82f6" },
  cattura: { bg: "bg-green-50 dark:bg-green-950/40", border: "border-green-400 dark:border-green-500", text: "text-green-700 dark:text-green-300", accent: "#22c55e" },
  gestione: { bg: "bg-violet-50 dark:bg-violet-950/40", border: "border-violet-400 dark:border-violet-500", text: "text-violet-700 dark:text-violet-300", accent: "#8b5cf6" },
  comunicazione: { bg: "bg-indigo-50 dark:bg-indigo-950/40", border: "border-indigo-400 dark:border-indigo-500", text: "text-indigo-700 dark:text-indigo-300", accent: "#6366f1" },
  conversione: { bg: "bg-orange-50 dark:bg-orange-950/40", border: "border-orange-400 dark:border-orange-500", text: "text-orange-700 dark:text-orange-300", accent: "#f97316" },
  delivery: { bg: "bg-emerald-50 dark:bg-emerald-950/40", border: "border-emerald-400 dark:border-emerald-500", text: "text-emerald-700 dark:text-emerald-300", accent: "#10b981" },
  custom: { bg: "bg-gray-50 dark:bg-gray-800/40", border: "border-gray-400 dark:border-gray-500", text: "text-gray-700 dark:text-gray-300", accent: "#6b7280" },
};

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  sorgenti: "Sorgenti",
  cattura: "Cattura",
  gestione: "Gestione",
  comunicazione: "Comunicazione",
  conversione: "Conversione",
  delivery: "Delivery",
  custom: "Custom",
};

export const NODE_TYPES: FunnelNodeType[] = [
  { type: "facebook_ads", label: "Facebook Ads", category: "sorgenti", icon: Facebook, description: "Campagna Facebook/Meta Ads" },
  { type: "google_ads", label: "Google Ads", category: "sorgenti", icon: Search, description: "Campagna Google Ads" },
  { type: "instagram_ads", label: "Instagram Ads", category: "sorgenti", icon: Instagram, description: "Campagna Instagram Ads" },
  { type: "tiktok_ads", label: "TikTok Ads", category: "sorgenti", icon: Music2, description: "Campagna TikTok Ads" },
  { type: "offline_referral", label: "Referral Offline", category: "sorgenti", icon: Users, description: "Passaparola e referral" },
  { type: "organic", label: "Organico", category: "sorgenti", icon: Leaf, description: "Traffico organico" },

  { type: "landing_page", label: "Landing Page", category: "cattura", icon: Globe, description: "Pagina di atterraggio" },
  { type: "form_modulo", label: "Form / Modulo", category: "cattura", icon: FileText, description: "Form di contatto" },
  { type: "lead_magnet", label: "Lead Magnet", category: "cattura", icon: Magnet, description: "Contenuto gratuito di valore" },
  { type: "webhook", label: "Webhook", category: "cattura", icon: Webhook, description: "Integrazione via webhook" },

  { type: "import_excel", label: "Import Excel", category: "gestione", icon: FileSpreadsheet, description: "Importa contatti da file" },
  { type: "crm_hunter", label: "CRM Hunter", category: "gestione", icon: Target, description: "Ricerca lead automatica" },
  { type: "setter_ai", label: "Setter AI", category: "gestione", icon: Bot, description: "Qualifica lead con AI" },

  { type: "whatsapp", label: "WhatsApp", category: "comunicazione", icon: MessageCircle, description: "Messaggio WhatsApp" },
  { type: "email", label: "Email", category: "comunicazione", icon: Mail, description: "Email automatica" },
  { type: "voice_call", label: "Chiamata Voice", category: "comunicazione", icon: Phone, description: "Chiamata vocale AI" },
  { type: "sms", label: "SMS", category: "comunicazione", icon: MessageSquare, description: "Messaggio SMS" },
  { type: "instagram_dm", label: "Instagram DM", category: "comunicazione", icon: Send, description: "Messaggio diretto Instagram" },

  { type: "appuntamento", label: "Appuntamento", category: "conversione", icon: Calendar, description: "Prenotazione appuntamento" },
  { type: "prima_call", label: "Prima Call", category: "conversione", icon: PhoneCall, description: "Prima chiamata di vendita" },
  { type: "seconda_call", label: "Seconda Call", category: "conversione", icon: PhoneForwarded, description: "Follow-up chiamata" },
  { type: "chiusura", label: "Chiusura", category: "conversione", icon: CheckCircle, description: "Chiusura vendita" },
  { type: "pagamento", label: "Pagamento", category: "conversione", icon: CreditCard, description: "Pagamento ricevuto" },

  { type: "onboarding", label: "Onboarding", category: "delivery", icon: UserPlus, description: "Onboarding cliente" },
  { type: "servizio", label: "Servizio", category: "delivery", icon: Briefcase, description: "Erogazione servizio" },
  { type: "followup", label: "Follow-up", category: "delivery", icon: RefreshCw, description: "Follow-up post-vendita" },

  { type: "nurturing_lead365", label: "Nurturing Lead 365", category: "comunicazione", icon: Flame, description: "Sequenza nurturing 365 giorni per lead proattivi" },
  { type: "email_journey", label: "Email Journey", category: "comunicazione", icon: Route, description: "Percorso email mensile per clienti attivi" },

  { type: "custom_step", label: "Step Custom", category: "custom", icon: Puzzle, description: "Step personalizzato" },
];

export function getNodeTypeDefinition(type: string): FunnelNodeType | undefined {
  return NODE_TYPES.find((n) => n.type === type);
}

export function getNodesByCategory(category: NodeCategory): FunnelNodeType[] {
  return NODE_TYPES.filter((n) => n.category === category);
}

const ENTITY_MAP: Record<string, EntityType> = {
  facebook_ads: "posts",
  google_ads: "posts",
  instagram_ads: "posts",
  tiktok_ads: "posts",
  organic: "posts",
  offline_referral: "referral_config",
  form_modulo: "optin_config",
  lead_magnet: "lead_magnet",
  crm_hunter: "hunter_searches",
  setter_ai: "ai_employees",
  onboarding: "lead_magnet",
  whatsapp: "agents",
  email: "email_accounts",
  voice_call: "voice_numbers",
  appuntamento: "booking",
  pagamento: "services",
  servizio: "services",
  followup: "campaigns",
  nurturing_lead365: "nurturing_config",
  email_journey: "email_journey_config",
};

export function getEntityTypeForNode(nodeType: string): EntityType | null {
  return ENTITY_MAP[nodeType] || null;
}

export function getPlatformFilterForNode(nodeType: string): string | null {
  const platformMap: Record<string, string> = {
    facebook_ads: "facebook",
    instagram_ads: "instagram",
    tiktok_ads: "tiktok",
  };
  return platformMap[nodeType] || null;
}

const EDIT_LINKS: Record<EntityType, string> = {
  posts: "/consultant/content-studio/ideas",
  referral_config: "/consultant/referrals/settings",
  optin_config: "/consultant/referrals/settings",
  lead_magnet: "/consultant/referrals",
  hunter_searches: "/consultant/ai-autonomy",
  ai_employees: "/consultant/ai-autonomy",
  agents: "/consultant/ai-autonomy",
  email_accounts: "/consultant/email-hub",
  voice_numbers: "/consultant/voice-calls",
  booking: "/consultant/referrals/settings",
  services: "/consultant/catalog-settings",
  campaigns: "/consultant/ai-autonomy",
  nurturing_config: "/consultant/ai-config",
  email_journey_config: "/consultant/ai-config",
  academy_lessons: "/consultant/academy",
};

export function getEditLinkForEntity(entityType: EntityType): string {
  return EDIT_LINKS[entityType] || "/consultant";
}

const ENTITY_LABELS: Record<EntityType, string> = {
  posts: "Post Content Studio",
  referral_config: "Pagina Referral",
  optin_config: "Pagina Optin",
  lead_magnet: "Lead Magnet AI",
  hunter_searches: "Ricerche Hunter",
  ai_employees: "Dipendente AI",
  agents: "Agente WhatsApp",
  email_accounts: "Account Email",
  voice_numbers: "Numero Voice",
  booking: "Prenotazione",
  services: "Servizio / Prodotto",
  campaigns: "Campagna Marketing",
  nurturing_config: "Nurturing Lead 365",
  email_journey_config: "Email Journey",
  academy_lessons: "Lezione Accademia",
};

export function getEntityLabel(entityType: EntityType): string {
  return ENTITY_LABELS[entityType] || "Entità";
}

export const NODE_TYPE_ACADEMY_MAP: Record<string, string[]> = {
  facebook_ads: ["pkg_cs_advisage", "pkg_cs_ideas"],
  google_ads: ["pkg_cs_advisage"],
  instagram_ads: ["pkg_cs_advisage", "instagram", "pkg_cs_ideas"],
  tiktok_ads: ["pkg_cs_advisage"],
  offline_referral: ["pkg_pay_vendere"],
  organic: ["pkg_cs_ideas", "pkg_cs_publer"],
  landing_page: ["agent_public_link"],
  form_modulo: ["lead_import"],
  lead_magnet: ["knowledge_base"],
  webhook: ["lead_import"],
  import_excel: ["lead_import"],
  crm_hunter: ["pkg_hunter_come_funziona", "pkg_hunter_ricerca", "pkg_hunter_contatto"],
  setter_ai: ["pkg_setter_come_funziona", "pkg_setter_primo_agente", "pkg_setter_qualifica"],
  whatsapp: ["agent_inbound", "whatsapp_template", "whatsapp_ai"],
  email: ["smtp", "email_hub", "pkg_email_hub"],
  voice_call: ["voice_calls", "pkg_voce_alessia", "pkg_voce_centralino"],
  sms: ["twilio"],
  instagram_dm: ["instagram"],
  nurturing_lead365: ["nurturing_emails", "pkg_email_nurturing"],
  email_journey: ["email_journey", "pkg_email_sequenza"],
  appuntamento: ["google_calendar", "google_calendar_agents", "pkg_lq_appuntamenti"],
  prima_call: ["agent_consultative", "pkg_lq_appuntamenti"],
  seconda_call: ["agent_consultative"],
  chiusura: ["stripe_connect", "pkg_pay_stripe"],
  pagamento: ["stripe_connect", "pkg_pay_stripe", "pkg_pay_vendere"],
  onboarding: ["first_course", "pkg_form_corso"],
  servizio: ["pkg_pay_modello", "pkg_team_licenze"],
  followup: ["summary_email", "first_campaign", "pkg_email_sequenza"],
  custom_step: [],
};
