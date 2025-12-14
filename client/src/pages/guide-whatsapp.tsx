import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquare, 
  Bot, 
  UserPlus, 
  Megaphone, 
  Settings,
  BookOpen,
  CheckCircle2,
  Upload,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Phone,
  Zap,
  FileText,
  Send,
  Users,
  Target,
  MessageCircle,
  Share2,
  BarChart3,
  Workflow
} from "lucide-react";
import { Link } from "wouter";

function ProgressIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < current ? "bg-current" : "bg-current/30"
            }`}
          />
        ))}
      </div>
      <span className="font-medium">Sezione {current} di {total}</span>
    </div>
  );
}

function SectionCard({ 
  children, 
  gradient, 
  borderColor,
  sectionNumber,
  title,
  subtitle,
  icon: Icon
}: { 
  children: React.ReactNode;
  gradient: string;
  borderColor: string;
  sectionNumber: number;
  title: string;
  subtitle: string;
  icon: React.ElementType;
}) {
  return (
    <Card className={`${gradient} ${borderColor} border-2`}>
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-xl bg-white/80 dark:bg-black/30 shadow-sm">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">{title}</CardTitle>
              <CardDescription className="mt-1">{subtitle}</CardDescription>
            </div>
          </div>
          <ProgressIndicator current={sectionNumber} total={3} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {children}
      </CardContent>
    </Card>
  );
}

function StepCard({
  number,
  title,
  description,
  icon: Icon,
  iconColor,
  badge,
  badgeVariant = "default",
  children,
  link,
  linkText
}: {
  number: number;
  title: string;
  description: string;
  icon: React.ElementType;
  iconColor: string;
  badge?: string;
  badgeVariant?: "default" | "destructive" | "outline" | "secondary";
  children?: React.ReactNode;
  link?: string;
  linkText?: string;
}) {
  return (
    <div className="bg-white/80 dark:bg-gray-900/80 backdrop-blur rounded-xl border p-5 shadow-sm">
      <div className="flex items-start gap-4">
        <div className={`${iconColor} text-white rounded-xl w-12 h-12 flex items-center justify-center font-bold text-lg shrink-0 shadow-lg`}>
          {number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <Icon className={`h-5 w-5 ${iconColor.replace('bg-', 'text-').replace('-500', '-600').replace('-600', '-600')}`} />
            <h4 className="font-semibold text-lg">{title}</h4>
            {badge && (
              <Badge variant={badgeVariant} className="ml-auto shrink-0">
                {badge}
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-3">{description}</p>
          {children}
          {link && linkText && (
            <Link href={link}>
              <Button variant="outline" size="sm" className="mt-3 gap-2">
                {linkText}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

function ChecklistItem({ checked = false, children }: { checked?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${checked ? 'text-green-500' : 'text-muted-foreground'}`} />
      <span>{children}</span>
    </li>
  );
}

function WarningBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-950/40 rounded-lg border border-amber-200 dark:border-amber-800">
      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
      <div className="text-sm text-amber-800 dark:text-amber-200">{children}</div>
    </div>
  );
}

function AgentTypesExplainer() {
  return (
    <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-500 text-white shadow-lg">
            <Bot className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Tipi di Agente WhatsApp
              <Badge variant="secondary">GUIDA RAPIDA</Badge>
            </CardTitle>
            <CardDescription>Scegli il tipo di agente in base al tuo obiettivo</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Phone className="h-4 w-4 text-blue-600" />
              Reattivo (Receptionist)
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              Risponde ai messaggi in arrivo, qualifica lead, prenota appuntamenti.
            </p>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              Ideale per: QR code, landing page
            </Badge>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border border-orange-200 dark:border-orange-800">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-600" />
              Proattivo (Setter)
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              Contatta lead proattivamente, fa follow-up automatici.
            </p>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
              Ideale per: Lead importati, Facebook Ads
            </Badge>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-purple-600" />
              Educativo (Advisor)
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              Fornisce info e contenuti, NON prenota appuntamenti.
            </p>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              Ideale per: FAQ, supporto clienti
            </Badge>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
          <h5 className="font-semibold mb-3 flex items-center gap-2">
            <Settings className="h-4 w-4 text-violet-600" />
            Modalita Integrazione
          </h5>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <MessageSquare className="h-3 w-3 mr-1" />
              WhatsApp + AI: Collegato a Twilio, messaggi reali
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              <Bot className="h-3 w-3 mr-1" />
              Solo AI: Senza Twilio, per test/chat interne
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/consultant/whatsapp">
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
              <Bot className="h-4 w-4" />
              Crea Nuovo Agente
            </Button>
          </Link>
          <Link href="/consultant/whatsapp/agents/chat">
            <Button variant="outline" className="gap-2">
              <MessageCircle className="h-4 w-4" />
              Chat con Agenti
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuideWhatsApp() {
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
          <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl shadow-lg">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Guida WhatsApp Business
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configura gli agenti AI WhatsApp in 3 semplici fasi
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Prerequisiti"
              subtitle="Setup iniziale obbligatorio - senza questi passaggi il sistema NON funziona"
              icon={ShieldCheck}
              gradient="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30"
              borderColor="border-red-200 dark:border-red-800"
            >
              <WarningBox>
                <strong>IMPORTANTE:</strong> Per inviare messaggi WhatsApp reali, devi avere un account Twilio configurato 
                con WhatsApp Business API. Senza credenziali Twilio, puoi usare solo la modalita "Solo AI" per test interni.
              </WarningBox>

              <StepCard
                number={1}
                title="Crea Account Twilio"
                description="Registrati su Twilio per ottenere le credenziali API necessarie per WhatsApp Business."
                icon={ExternalLink}
                iconColor="bg-red-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vai su twilio.com e crea account</ChecklistItem>
                  <ChecklistItem>Dashboard → Account Info → copia Account SID (inizia con AC...)</ChecklistItem>
                  <ChecklistItem>Copia Auth Token (stringa lunga segreta)</ChecklistItem>
                  <ChecklistItem>Phone Numbers → WhatsApp → ottieni numero Business</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Inserisci Credenziali nell'Agente"
                description="Le credenziali vanno inserite quando crei o modifichi un agente WhatsApp."
                icon={Settings}
                iconColor="bg-orange-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
                link="/consultant/whatsapp"
                linkText="Vai agli Agenti"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Account SID: Inizia con "AC..."</ChecklistItem>
                  <ChecklistItem>Auth Token: Stringa alfanumerica lunga</ChecklistItem>
                  <ChecklistItem>Numero WhatsApp: Formato +39...</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Alternativa: Modalita Solo AI"
                description="Se non hai Twilio, puoi comunque testare gli agenti in modalita Solo AI."
                icon={Bot}
                iconColor="bg-purple-500"
                badge="OPZIONALE"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Nessuna credenziale richiesta</ChecklistItem>
                  <ChecklistItem>Chat interna solo nell'app</ChecklistItem>
                  <ChecklistItem>Perfetto per test e simulazioni</ChecklistItem>
                  <ChecklistItem>Puoi aggiungere Twilio in seguito</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              title="Configurazione Agenti"
              subtitle="Crea e configura agenti AI per automatizzare le conversazioni WhatsApp"
              icon={Bot}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={1}
                title="Crea Nuovo Agente"
                description="Avvia il wizard guidato in 4 step per configurare un agente da zero."
                icon={UserPlus}
                iconColor="bg-green-500"
                badge="STEP 1"
                link="/consultant/whatsapp"
                linkText="Crea Agente"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Nome agente (es: "Receptionist Marco")</ChecklistItem>
                  <ChecklistItem>Tipo: Reattivo, Proattivo o Educativo</ChecklistItem>
                  <ChecklistItem>Modalita: WhatsApp+AI o Solo AI</ChecklistItem>
                  <ChecklistItem>Credenziali Twilio (se WhatsApp+AI)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Imposta Disponibilita"
                description="Configura orari di lavoro e funzionalita dell'agente."
                icon={Clock}
                iconColor="bg-blue-500"
                badge="STEP 2"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Orari di lavoro (es: Lun-Ven 9-18)</ChecklistItem>
                  <ChecklistItem>Messaggio fuori orario personalizzato</ChecklistItem>
                  <ChecklistItem>Prenotazione appuntamenti (se calendario collegato)</ChecklistItem>
                  <ChecklistItem>Gestione obiezioni e disqualificazione</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Configura Brand Voice"
                description="Inserisci le informazioni aziendali per personalizzare le risposte."
                icon={Target}
                iconColor="bg-amber-500"
                badge="STEP 3"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Nome business e descrizione</ChecklistItem>
                  <ChecklistItem>Bio consulente e USP</ChecklistItem>
                  <ChecklistItem>Mission, Vision, Valori</ChecklistItem>
                  <ChecklistItem>Credibilita: anni esperienza, clienti, risultati</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={4}
                title="Istruzioni AI e Template"
                description="Scegli il template predefinito o personalizza il comportamento dell'agente."
                icon={FileText}
                iconColor="bg-violet-500"
                badge="STEP 4"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Template: Receptionist, Marco Setter, Educativo</ChecklistItem>
                  <ChecklistItem>Personalita: Amico fidato, Consulente esperto, Coach</ChecklistItem>
                  <ChecklistItem>Dry Run Mode per test senza invio reale</ChecklistItem>
                </ul>
              </StepCard>

              <AgentTypesExplainer />

              <StepCard
                number={5}
                title="Template Messaggi Custom"
                description="Crea template con variabili dinamiche per messaggi personalizzati."
                icon={Send}
                iconColor="bg-cyan-500"
                link="/consultant/whatsapp/custom-templates/list"
                linkText="Gestisci Template"
              >
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-3">
                  <p className="text-sm font-mono">
                    Variabili disponibili:<br />
                    <span className="text-green-600">{"{nome_lead}"}</span> = nome del contatto<br />
                    <span className="text-green-600">{"{uncino}"}</span> = uncino della campagna<br />
                    <span className="text-green-600">{"{obiettivi}"}</span> = obiettivi stato ideale
                  </p>
                </div>
                <ul className="space-y-1.5">
                  <ChecklistItem>Tipi: apertura, follow-up gentile, valore, finale</ChecklistItem>
                  <ChecklistItem>Preview in tempo reale con dati reali</ChecklistItem>
                  <ChecklistItem>Assegna template specifici per campagna</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              title="Utilizzo Operativo"
              subtitle="Chat, conversazioni, campagne e monitoraggio lead"
              icon={Workflow}
              gradient="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={1}
                title="Chat con gli Agenti"
                description="Testa i tuoi agenti chattando direttamente con loro prima di attivarli."
                icon={MessageCircle}
                iconColor="bg-blue-500"
                link="/consultant/whatsapp/agents/chat"
                linkText="Vai alla Chat"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Tab Interne: Conversazioni di test fatte da te</ChecklistItem>
                  <ChecklistItem>Tab Pubbliche: Conversazioni reali con clienti</ChecklistItem>
                  <ChecklistItem>Invia messaggi, immagini e vocali</ChecklistItem>
                  <ChecklistItem>Verifica risposte prima di attivare l'agente</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Condividi Agente"
                description="Crea un link pubblico per permettere ai visitatori di chattare con l'agente."
                icon={Share2}
                iconColor="bg-purple-500"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Clicca icona "Condividi" sull'agente</ChecklistItem>
                  <ChecklistItem>Copia il link pubblico generato</ChecklistItem>
                  <ChecklistItem>Visitatori possono chattare senza login</ChecklistItem>
                  <ChecklistItem>Perfetto per landing page e demo</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Crea Campagne Marketing"
                description="Organizza i lead in campagne con uncini e template dedicati."
                icon={Megaphone}
                iconColor="bg-amber-500"
                link="/consultant/campaigns"
                linkText="Vai alle Campagne"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Nome campagna descrittivo (es: "Facebook Ads Q1 2025")</ChecklistItem>
                  <ChecklistItem>Configura l'uncino per catturare attenzione</ChecklistItem>
                  <ChecklistItem>Imposta obiettivi e stato ideale del lead</ChecklistItem>
                  <ChecklistItem>Assegna template WhatsApp specifici</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={4}
                title="Importa e Gestisci Lead"
                description="Importa lead da CSV e assegnali automaticamente alle campagne."
                icon={Upload}
                iconColor="bg-emerald-500"
                link="/consultant/proactive-leads"
                linkText="Importa Lead"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Formato CSV: Nome, Cognome, Telefono</ChecklistItem>
                  <ChecklistItem>Seleziona campagna per ereditare uncino e template</ChecklistItem>
                  <ChecklistItem>Programma quando contattare ogni lead</ChecklistItem>
                </ul>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-sm">
                    <strong>Stati Lead:</strong><br />
                    🟡 Pending → 🔵 Contacted → 🟢 Responded → ✅ Converted
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Monitora Performance"
                description="Analizza metriche e conversion rate delle tue campagne."
                icon={BarChart3}
                iconColor="bg-indigo-500"
                link="/consultant/campaigns"
                linkText="Vedi Analytics"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Lead totali gestiti per campagna</ChecklistItem>
                  <ChecklistItem>Lead convertiti e conversion rate %</ChecklistItem>
                  <ChecklistItem>Tempo medio di risposta</ChecklistItem>
                  <ChecklistItem>Confronta performance tra campagne</ChecklistItem>
                </ul>
              </StepCard>

              <WarningBox>
                <strong>Dry Run Mode:</strong> Prima di attivare l'invio reale, testa sempre con Dry Run ON. 
                I messaggi vengono simulati ma NON inviati. Quando sei sicuro, disattiva Dry Run per inviare messaggi reali.
              </WarningBox>
            </SectionCard>

            <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ChevronRight className="h-5 w-5 text-green-600" />
                  Link Rapidi
                </CardTitle>
                <CardDescription>Accedi velocemente alle funzionalita WhatsApp</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <Link href="/consultant/whatsapp">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <Bot className="h-5 w-5 text-green-600" />
                      <span className="text-xs">Agenti WhatsApp</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp/agents/chat">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <MessageCircle className="h-5 w-5 text-blue-600" />
                      <span className="text-xs">Chat Agenti</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/campaigns">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <Megaphone className="h-5 w-5 text-amber-600" />
                      <span className="text-xs">Campagne</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/proactive-leads">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <Users className="h-5 w-5 text-purple-600" />
                      <span className="text-xs">Lead Pipeline</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp/custom-templates/list">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <FileText className="h-5 w-5 text-cyan-600" />
                      <span className="text-xs">Template Custom</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp-templates">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <Send className="h-5 w-5 text-indigo-600" />
                      <span className="text-xs">Template Twilio</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp-conversations">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <MessageSquare className="h-5 w-5 text-emerald-600" />
                      <span className="text-xs">Conversazioni</span>
                    </Button>
                  </Link>
                  <Link href="/consultant/api-settings">
                    <Button variant="outline" className="w-full gap-2 h-auto py-3 flex-col">
                      <Settings className="h-5 w-5 text-gray-600" />
                      <span className="text-xs">API Settings</span>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle>💡 Consigli per il Successo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Best Practice Agenti</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Testa sempre in Dry Run prima di attivare</li>
                      <li>• Usa un agente Reattivo per landing page</li>
                      <li>• Usa un agente Proattivo per follow-up lead</li>
                      <li>• Personalizza le istruzioni AI per il tuo business</li>
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Ottimizzazione Campagne</h4>
                    <ul className="text-sm space-y-1 text-muted-foreground">
                      <li>• Crea uncini specifici per ogni fonte di lead</li>
                      <li>• Monitora conversion rate e ottimizza</li>
                      <li>• Segmenta lead per temperatura (caldo/freddo)</li>
                      <li>• A/B test su template messaggi diversi</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
