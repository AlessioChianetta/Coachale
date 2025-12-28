import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { 
  MessageSquare, 
  Mail, 
  Zap, 
  FileText, 
  UserPlus, 
  Bot, 
  Key, 
  GraduationCap,
  Users,
  CalendarDays,
  BookOpen,
  ArrowRight,
  Sparkles,
  Clock,
  Star
} from "lucide-react";
import { Link } from "wouter";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";

interface GuideCardProps {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  gradient: string;
  iconColor: string;
  badge?: string;
  badgeColor?: string;
  duration?: string;
  difficulty?: "Facile" | "Medio" | "Avanzato";
  index: number;
}

function GuideCard({ 
  title, 
  description, 
  icon: Icon, 
  href, 
  gradient, 
  iconColor,
  badge,
  badgeColor = "bg-blue-500",
  duration,
  difficulty,
  index 
}: GuideCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const difficultyColors = {
    "Facile": "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
    "Medio": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
    "Avanzato": "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.08 }}
    >
      <Link href={href}>
        <Card 
          className={`relative overflow-hidden cursor-pointer transition-all duration-300 hover:shadow-xl hover:scale-[1.02] ${gradient} border-2 group`}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {badge && (
            <div className={`absolute top-3 right-3 ${badgeColor} text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg`}>
              {badge}
            </div>
          )}
          
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <motion.div 
                className={`p-4 rounded-2xl ${iconColor} shadow-lg`}
                animate={{ 
                  rotate: isHovered ? [0, -5, 5, -5, 0] : 0,
                  scale: isHovered ? 1.1 : 1
                }}
                transition={{ duration: 0.4 }}
              >
                <Icon className="h-7 w-7 text-white" />
              </motion.div>
              
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {title}
                </h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                  {description}
                </p>
                
                <div className="flex items-center gap-3 flex-wrap">
                  {duration && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {duration}
                    </span>
                  )}
                  {difficulty && (
                    <Badge variant="secondary" className={difficultyColors[difficulty]}>
                      {difficulty}
                    </Badge>
                  )}
                </div>
              </div>
              
              <motion.div
                className="self-center"
                animate={{ x: isHovered ? 5 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-blue-500 transition-colors" />
              </motion.div>
            </div>
          </CardContent>
          
          <motion.div 
            className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: isHovered ? 1 : 0 }}
            transition={{ duration: 0.3 }}
            style={{ transformOrigin: 'left' }}
          />
        </Card>
      </Link>
    </motion.div>
  );
}

const guides = [
  {
    title: "Setup Agenti WhatsApp",
    description: "Crea e configura agenti AI WhatsApp con il wizard step-by-step. Impara a creare receptionist, setter e advisor automatici.",
    icon: Bot,
    href: "/consultant/guide-agents",
    gradient: "bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30 border-emerald-200 dark:border-emerald-800",
    iconColor: "bg-gradient-to-br from-emerald-500 to-green-600",
    badge: "CONSIGLIATO",
    badgeColor: "bg-emerald-500",
    duration: "15 min",
    difficulty: "Medio" as const
  },
  {
    title: "WhatsApp Messaging",
    description: "Configura WhatsApp Business, webhook Twilio e gestisci le conversazioni con i tuoi lead in modo automatico.",
    icon: MessageSquare,
    href: "/consultant/guide-whatsapp",
    gradient: "bg-gradient-to-br from-green-50 to-teal-50 dark:from-green-950/30 dark:to-teal-950/30 border-green-200 dark:border-green-800",
    iconColor: "bg-gradient-to-br from-green-500 to-teal-600",
    duration: "10 min",
    difficulty: "Medio" as const
  },
  {
    title: "Instagram DM Integration",
    description: "Configura Instagram Business per ricevere e rispondere automaticamente ai DM. Gestisci la finestra 24h e le risposte alle storie.",
    icon: MessageSquare,
    href: "/consultant/guide-instagram",
    gradient: "bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30 border-cyan-200 dark:border-cyan-800",
    iconColor: "bg-gradient-to-br from-cyan-500 to-teal-600",
    badge: "NUOVO",
    badgeColor: "bg-cyan-500",
    duration: "12 min",
    difficulty: "Medio" as const
  },
  {
    title: "Template WhatsApp",
    description: "Gestisci template Twilio approvati e template custom per messaggi personalizzati. Impara le best practice per l'approvazione.",
    icon: FileText,
    href: "/consultant/guide-templates",
    gradient: "bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800",
    iconColor: "bg-gradient-to-br from-violet-500 to-purple-600",
    duration: "8 min",
    difficulty: "Facile" as const
  },
  {
    title: "CRM Lead Proattivi",
    description: "Importa, gestisci e qualifica i tuoi lead. Scopri come usare tag, filtri e schedulazione per massimizzare le conversioni.",
    icon: UserPlus,
    href: "/consultant/guide-leads",
    gradient: "bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800",
    iconColor: "bg-gradient-to-br from-blue-500 to-cyan-600",
    badge: "NUOVO",
    badgeColor: "bg-blue-500",
    duration: "12 min",
    difficulty: "Facile" as const
  },
  {
    title: "Automazioni",
    description: "Crea workflow automatici per follow-up, nurturing e qualificazione lead. Automatizza il tuo processo di vendita.",
    icon: Zap,
    href: "/consultant/guide-automations",
    gradient: "bg-gradient-to-br from-purple-50 to-fuchsia-50 dark:from-purple-950/30 dark:to-fuchsia-950/30 border-purple-200 dark:border-purple-800",
    iconColor: "bg-gradient-to-br from-purple-500 to-fuchsia-600",
    duration: "10 min",
    difficulty: "Avanzato" as const
  },
  {
    title: "Email Journey",
    description: "Configura email automatiche, reminder appuntamenti e sequenze di nurturing per mantenere i lead caldi.",
    icon: Mail,
    href: "/consultant/guide-email",
    gradient: "bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-sky-200 dark:border-sky-800",
    iconColor: "bg-gradient-to-br from-sky-500 to-blue-600",
    duration: "8 min",
    difficulty: "Facile" as const
  },
  {
    title: "API Keys & Integrazioni",
    description: "Configura Vertex AI, SMTP, Google Calendar e server TURN per video meeting. Tutte le integrazioni in un'unica guida.",
    icon: Key,
    href: "/consultant/guide-api-keys",
    gradient: "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800",
    iconColor: "bg-gradient-to-br from-amber-500 to-orange-600",
    duration: "15 min",
    difficulty: "Avanzato" as const
  },
  {
    title: "Calendario & Appuntamenti",
    description: "Sincronizza Google Calendar, gestisci disponibilità e automatizza la prenotazione appuntamenti con i tuoi clienti.",
    icon: CalendarDays,
    href: "/consultant/guide-calendar",
    gradient: "bg-gradient-to-br from-rose-50 to-pink-50 dark:from-rose-950/30 dark:to-pink-950/30 border-rose-200 dark:border-rose-800",
    iconColor: "bg-gradient-to-br from-rose-500 to-pink-600",
    duration: "6 min",
    difficulty: "Facile" as const
  },
  {
    title: "Gestione Clienti",
    description: "Aggiungi clienti, assegna percorsi formativi e monitora i loro progressi nel tempo.",
    icon: Users,
    href: "/consultant/guide-clients",
    gradient: "bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 border-indigo-200 dark:border-indigo-800",
    iconColor: "bg-gradient-to-br from-indigo-500 to-violet-600",
    duration: "8 min",
    difficulty: "Facile" as const
  },
  {
    title: "Università & Formazione",
    description: "Crea corsi, moduli e lezioni per i tuoi clienti. Gestisci contenuti formativi e monitora i progressi.",
    icon: GraduationCap,
    href: "/consultant/guide-university",
    gradient: "bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800",
    iconColor: "bg-gradient-to-br from-yellow-500 to-amber-600",
    duration: "10 min",
    difficulty: "Medio" as const
  }
];

export default function GuidesHub() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className="flex">
        {isMobile ? (
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        ) : (
          <Sidebar role="consultant" />
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-6xl mx-auto">
            <motion.div 
              className="text-center mb-12"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className="inline-flex items-center gap-3 mb-6">
                <div className="p-4 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl">
                  <BookOpen className="h-10 w-10 text-white" />
                </div>
                <Sparkles className="h-8 w-8 text-yellow-500 animate-pulse" />
              </div>
              
              <h1 className="text-4xl md:text-5xl font-bold mb-4">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Centro Guide
                </span>
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Esplora tutte le guide disponibili per padroneggiare ogni funzionalità della piattaforma. 
                Scegli da dove iniziare e diventa un esperto!
              </p>
              
              <div className="flex items-center justify-center gap-6 mt-6">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <span>{guides.length} Guide Disponibili</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 text-blue-500" />
                  <span>~100 min totali</span>
                </div>
              </div>
            </motion.div>

            <div className="grid gap-4 md:gap-6 md:grid-cols-2">
              {guides.map((guide, index) => (
                <GuideCard
                  key={guide.href}
                  {...guide}
                  index={index}
                />
              ))}
            </div>

            <motion.div 
              className="mt-12 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
            >
              <div className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/30 dark:to-purple-950/30 rounded-full border border-blue-200 dark:border-blue-800">
                <Sparkles className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Nuove guide vengono aggiunte regolarmente. Torna a visitare!
                </span>
              </div>
            </motion.div>
          </div>
        </main>
      </div>
    </div>
  );
}
