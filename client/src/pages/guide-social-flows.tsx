import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageCircle,
  Instagram,
  Twitter,
  Linkedin,
  ArrowRight,
  Bot,
  Calendar,
  Sparkles,
  Send,
  Users,
  MousePointerClick,
  Link2,
  MessageSquare,
  Zap,
  Clock,
  Target,
  BookOpen
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

function FlowStep({ 
  icon: Icon, 
  title, 
  description, 
  isLast = false,
  automated = false,
  stepNumber
}: { 
  icon: React.ElementType;
  title: string;
  description: string;
  isLast?: boolean;
  automated?: boolean;
  stepNumber: number;
}) {
  return (
    <motion.div 
      className="flex items-start gap-4"
      variants={fadeInUp}
    >
      <div className="flex flex-col items-center">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white shadow-lg ${
          automated ? "bg-gradient-to-br from-green-500 to-emerald-600" : "bg-gradient-to-br from-gray-400 to-gray-500"
        }`}>
          {stepNumber}
        </div>
        {!isLast && (
          <div className={`w-0.5 h-16 mt-2 ${automated ? "bg-green-300" : "bg-gray-300"}`} />
        )}
      </div>
      <div className="flex-1 pb-8">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-5 w-5 ${automated ? "text-green-600" : "text-gray-500"}`} />
          <h4 className="font-semibold text-lg">{title}</h4>
          {automated && (
            <Badge className="bg-green-100 text-green-700 border-green-200">
              <Zap className="h-3 w-3 mr-1" />
              Automatico
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}

function PlatformCard({ 
  icon: Icon, 
  title, 
  subtitle,
  gradient,
  borderColor,
  iconColor,
  children,
  isAutomated = false
}: { 
  icon: React.ElementType;
  title: string;
  subtitle: string;
  gradient: string;
  borderColor: string;
  iconColor: string;
  children: React.ReactNode;
  isAutomated?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <Card className={`${gradient} ${borderColor} border-2 overflow-hidden hover:shadow-xl transition-shadow duration-300`}>
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-xl ${iconColor} shadow-lg`}>
                <Icon className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl">{title}</CardTitle>
                  {isAutomated ? (
                    <Badge className="bg-green-100 text-green-700 border-green-200">
                      <Bot className="h-3 w-3 mr-1" />
                      Automatizzato
                    </Badge>
                  ) : (
                    <Badge variant="secondary">
                      <Users className="h-3 w-3 mr-1" />
                      Manuale
                    </Badge>
                  )}
                </div>
                <CardDescription className="mt-1">{subtitle}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {children}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CTAExample({ 
  text, 
  emoji 
}: { 
  text: string; 
  emoji: string;
}) {
  return (
    <div className="bg-white/80 dark:bg-gray-800/80 rounded-lg p-3 border shadow-sm flex items-center gap-2">
      <span className="text-xl">{emoji}</span>
      <span className="text-sm font-medium">{text}</span>
    </div>
  );
}

export default function GuideSocialFlows() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
            
            <motion.div 
              className="text-center space-y-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 text-purple-700 dark:text-purple-300 font-medium">
                <Sparkles className="h-4 w-4" />
                Guida ai Flussi Social
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                Come Funzionano i Tuoi Canali
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Scopri come convertire i follower in clienti su ogni piattaforma social. 
                Alcuni canali sono completamente automatizzati, altri richiedono la tua interazione.
              </p>
            </motion.div>

            <motion.div 
              className="grid gap-6 md:grid-cols-2"
              variants={staggerContainer}
              initial="initial"
              animate="animate"
            >
              <PlatformCard
                icon={MessageCircle}
                title="WhatsApp Business"
                subtitle="Automazione completa con AI"
                gradient="bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-900/30"
                borderColor="border-green-200 dark:border-green-800"
                iconColor="bg-gradient-to-br from-green-500 to-emerald-600"
                isAutomated={true}
              >
                <div className="space-y-1">
                  <FlowStep
                    icon={Send}
                    title="L'utente ti scrive"
                    description="Scrive un messaggio WhatsApp al tuo numero business, oppure si iscrive a una campagna marketing"
                    stepNumber={1}
                    automated
                  />
                  <FlowStep
                    icon={Bot}
                    title="L'AI risponde automaticamente"
                    description="Il tuo agente AI risponde immediatamente, qualifica il lead e risponde alle domande"
                    stepNumber={2}
                    automated
                  />
                  <FlowStep
                    icon={MessageSquare}
                    title="Conversazione guidata"
                    description="L'AI gestisce tutta la conversazione, risolvendo dubbi e obiezioni"
                    stepNumber={3}
                    automated
                  />
                  <FlowStep
                    icon={Calendar}
                    title="Prenotazione automatica"
                    description="L'utente prenota una call direttamente nella chat, sincronizzata con il tuo calendario"
                    stepNumber={4}
                    automated
                    isLast
                  />
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 mt-4">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-green-600" />
                    Come Attivare il Flusso
                  </h5>
                  <div className="grid gap-2">
                    <CTAExample emoji="📲" text="L'utente salva il tuo numero e ti scrive" />
                    <CTAExample emoji="📋" text="L'utente compila un form e viene contattato" />
                    <CTAExample emoji="🔗" text="Click su link wa.me nella bio o nei post" />
                  </div>
                </div>
              </PlatformCard>

              <PlatformCard
                icon={Instagram}
                title="Instagram DM"
                subtitle="Automazione completa con AI"
                gradient="bg-gradient-to-br from-pink-50 to-purple-100 dark:from-pink-950/50 dark:to-purple-900/30"
                borderColor="border-pink-200 dark:border-pink-800"
                iconColor="bg-gradient-to-br from-pink-500 to-purple-600"
                isAutomated={true}
              >
                <div className="space-y-1">
                  <FlowStep
                    icon={Send}
                    title="L'utente ti scrive in DM"
                    description="Ti manda un messaggio diretto su Instagram o risponde a una storia"
                    stepNumber={1}
                    automated
                  />
                  <FlowStep
                    icon={Bot}
                    title="L'AI risponde automaticamente"
                    description="Il tuo agente AI risponde entro pochi secondi, 24/7"
                    stepNumber={2}
                    automated
                  />
                  <FlowStep
                    icon={MessageSquare}
                    title="Conversazione guidata"
                    description="L'AI gestisce la conversazione, risponde alle domande e qualifica il lead"
                    stepNumber={3}
                    automated
                  />
                  <FlowStep
                    icon={Calendar}
                    title="Prenotazione automatica"
                    description="L'utente prenota direttamente nei DM, riceve conferma immediata"
                    stepNumber={4}
                    automated
                    isLast
                  />
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 mt-4">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-pink-600" />
                    Come Attivare il Flusso
                  </h5>
                  <div className="grid gap-2">
                    <CTAExample emoji="💬" text="L'utente ti scrive in DM" />
                    <CTAExample emoji="📸" text="Risposta a una storia" />
                    <CTAExample emoji="🔗" text="CTA nei post: 'Scrivimi INFO in DM'" />
                  </div>
                </div>
              </PlatformCard>

              <PlatformCard
                icon={Twitter}
                title="X (Twitter)"
                subtitle="Auto-DM con Typefully + handoff WhatsApp"
                gradient="bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-950/50 dark:to-slate-900/30"
                borderColor="border-gray-200 dark:border-gray-700"
                iconColor="bg-gradient-to-br from-gray-700 to-black"
                isAutomated={false}
              >
                <div className="space-y-1">
                  <FlowStep
                    icon={MousePointerClick}
                    title="Pubblica tweet con CTA"
                    description="Il tweet DEVE menzionare che riceveranno un DM. Es: 'Reply ORBITA e ti mando un DM con checklist + audit'"
                    stepNumber={1}
                  />
                  <FlowStep
                    icon={MessageSquare}
                    title="L'utente risponde al tweet"
                    description="Commenta con la parola chiave (es: 'ORBITA', 'INFO', 'BONUS')"
                    stepNumber={2}
                  />
                  <FlowStep
                    icon={Send}
                    title="Typefully invia Auto-DM"
                    description="DM automatico con link WhatsApp: 'Avvia l'audit su WhatsApp: wa.me/39XXX?text=ORBITA'"
                    stepNumber={3}
                    automated
                  />
                  <FlowStep
                    icon={Bot}
                    title="AI takeover su WhatsApp"
                    description="L'utente clicca il link → scrive su WhatsApp → l'AI prende il controllo della conversazione"
                    stepNumber={4}
                    automated
                    isLast
                  />
                </div>

                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 rounded-xl p-4 mt-4 border border-purple-200 dark:border-purple-800">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    Setup Typefully Auto-DM (7 Step)
                  </h5>
                  <div className="space-y-3 text-sm">
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                      <div>
                        <p className="font-medium">Collega X a Typefully</p>
                        <p className="text-muted-foreground">typefully.com → Settings → Connected accounts → Collega X</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                      <div>
                        <p className="font-medium">Scrivi il tweet con menzione DM</p>
                        <p className="text-muted-foreground">Deve contenere "DM" o "message" altrimenti Typefully non attiva l'automazione</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                      <div>
                        <p className="font-medium">Attiva Auto-DM</p>
                        <p className="text-muted-foreground">Publish → Engagement tools → Toggle Auto-DM → Trigger: Reply</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                      <div>
                        <p className="font-medium">Scrivi il messaggio Auto-DM</p>
                        <p className="text-muted-foreground">"Perfetto ✅ Avvia l'audit su WhatsApp: wa.me/39XXX?text=ORBITA"</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">5</span>
                      <div>
                        <p className="font-medium">Pubblica il tweet</p>
                        <p className="text-muted-foreground">Publish now o Schedule → La campagna Auto-DM parte automaticamente</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">6</span>
                      <div>
                        <p className="font-medium">Backup pubblico (importante!)</p>
                        <p className="text-muted-foreground">Rispondi al tuo tweet con il link WA → Cattura utenti con DM chiusi</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-gray-800/80 rounded-lg p-3">
                      <span className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0">7</span>
                      <div>
                        <p className="font-medium">Testa con account secondario</p>
                        <p className="text-muted-foreground">Rispondi al tweet → Verifica che arrivi il DM → Controlla in Typefully: Sent ✅</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 mt-4">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-gray-600" />
                    Template Tweet Pronto
                  </h5>
                  <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4 text-sm font-mono">
                    <p>Se ricevi lead su WhatsApp/IG e rispondi tardi, stai perdendo appuntamenti.</p>
                    <p className="mt-2">Reply ORBITA e ti mando un DM con checklist + audit automatico.</p>
                  </div>
                </div>

                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                  <h5 className="font-semibold mb-2 flex items-center gap-2 text-amber-800 dark:text-amber-200">
                    <Clock className="h-4 w-4" />
                    Limiti Typefully
                  </h5>
                  <ul className="text-sm text-amber-800 dark:text-amber-200 space-y-1">
                    <li>• Controlla reply per 4 giorni dopo il post</li>
                    <li>• Max 500 DM/giorno, 30/minuto</li>
                    <li>• Fallisce se l'utente ha DM chiusi (usa backup pubblico!)</li>
                  </ul>
                </div>
              </PlatformCard>

              <PlatformCard
                icon={Linkedin}
                title="LinkedIn"
                subtitle="Gestione manuale con CTA strategiche"
                gradient="bg-gradient-to-br from-blue-50 to-sky-100 dark:from-blue-950/50 dark:to-sky-900/30"
                borderColor="border-blue-200 dark:border-blue-800"
                iconColor="bg-gradient-to-br from-blue-600 to-blue-800"
                isAutomated={false}
              >
                <div className="space-y-1">
                  <FlowStep
                    icon={MousePointerClick}
                    title="Pubblica contenuto con CTA"
                    description="Post professionale con call-to-action: commenta, collegati, o visita il link"
                    stepNumber={1}
                  />
                  <FlowStep
                    icon={MessageSquare}
                    title="L'utente interagisce"
                    description="Commenta 'INTERESSATO', chiede collegamento, o clicca sul link"
                    stepNumber={2}
                  />
                  <FlowStep
                    icon={Send}
                    title="Tu rispondi manualmente"
                    description="Accetta il collegamento e invia messaggio personalizzato, oppure rispondi al commento"
                    stepNumber={3}
                  />
                  <FlowStep
                    icon={Calendar}
                    title="Conversione"
                    description="L'utente visita il link → prenota call → diventa cliente"
                    stepNumber={4}
                    isLast
                  />
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-4 mt-4">
                  <h5 className="font-semibold mb-3 flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    Esempi di CTA per i Post
                  </h5>
                  <div className="grid gap-2">
                    <CTAExample emoji="💼" text="Commenta 'INFO' e ti mando la risorsa in privato" />
                    <CTAExample emoji="🔗" text="Link nel primo commento per la consulenza gratuita" />
                    <CTAExample emoji="🤝" text="Collegati con me per ricevere contenuti esclusivi" />
                    <CTAExample emoji="📩" text="Scrivimi in DM 'STRATEGIA' per una mini-analisi" />
                  </div>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-800 dark:text-blue-200 flex items-start gap-2">
                    <BookOpen className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>
                      <strong>Best Practice:</strong> Su LinkedIn i contenuti professionali e case study funzionano meglio. 
                      Usa le CTA per creare engagement e poi converti in privato.
                    </span>
                  </p>
                </div>
              </PlatformCard>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <Card className="bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-orange-950/30 border-2 border-purple-200 dark:border-purple-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                    Riepilogo: Quale Canale per Cosa?
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-5 border">
                      <div className="flex items-center gap-2 mb-3">
                        <Bot className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-green-700 dark:text-green-400">Canali Automatizzati</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <MessageCircle className="h-5 w-5 text-green-500" />
                          <span><strong>WhatsApp:</strong> Conversazione AI completa + prenotazione</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Instagram className="h-5 w-5 text-pink-500" />
                          <span><strong>Instagram:</strong> Risposta DM automatica + prenotazione</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">
                        Ideali per lead caldi che vogliono informazioni immediate e prenotare subito.
                      </p>
                    </div>

                    <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl p-5 border">
                      <div className="flex items-center gap-2 mb-3">
                        <Users className="h-5 w-5 text-blue-600" />
                        <h4 className="font-semibold text-blue-700 dark:text-blue-400">Canali Manuali (CTA)</h4>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Twitter className="h-5 w-5 text-gray-700" />
                          <span><strong>X:</strong> CTA nei post → link in bio → conversione</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Linkedin className="h-5 w-5 text-blue-600" />
                          <span><strong>LinkedIn:</strong> CTA professionali → collegamento → DM</span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-4">
                        Perfetti per costruire autorità e generare lead attraverso contenuti di valore.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
              className="flex justify-center"
            >
              <Link href="/content-studio">
                <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg">
                  Torna al Content Marketing Studio
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </motion.div>

          </div>
        </div>
      </div>
    </div>
  );
}
