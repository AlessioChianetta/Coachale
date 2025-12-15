import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Calendar,
  Settings,
  Video,
  Link2,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Bell,
  Users,
  Shield,
  ChevronRight,
  CalendarDays,
  CalendarPlus,
  RefreshCw,
  ExternalLink,
  Server,
  Zap
} from "lucide-react";
import { Link } from "wouter";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";

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

function VideoMeetingExplainer() {
  return (
    <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-500 text-white shadow-lg">
            <Video className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Video Meeting - Guida Completa
              <Badge variant="secondary">AVANZATO</Badge>
            </CardTitle>
            <CardDescription>Sistema di videochiamate integrato con AI Copilot</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Server className="h-4 w-4 text-violet-600" />
              Cos'è il TURN Server?
            </h5>
            <p className="text-sm text-muted-foreground">
              Il TURN server (Twilio) permette le videochiamate anche quando i firewall bloccano le connessioni dirette. 
              È essenziale per garantire connessioni stabili con tutti i clienti.
            </p>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-violet-600" />
              AI Copilot in Chiamata
            </h5>
            <p className="text-sm text-muted-foreground">
              Durante la videochiamata, l'AI Copilot ti suggerisce in tempo reale cosa dire, 
              analizza il sentiment del cliente e ti guida nello script di vendita.
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
          <h5 className="font-semibold mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4 text-violet-600" />
            Funzionalità Video Meeting
          </h5>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <Video className="h-3 w-3 mr-1" />
              Video HD
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              <Users className="h-3 w-3 mr-1" />
              Multi-partecipanti
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              <Zap className="h-3 w-3 mr-1" />
              AI Copilot
            </Badge>
            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
              <RefreshCw className="h-3 w-3 mr-1" />
              Registrazione
            </Badge>
          </div>
        </div>

        <WarningBox>
          <strong>Importante:</strong> Per utilizzare le videochiamate con connessioni stabili, 
          devi configurare le credenziali Twilio nelle impostazioni. Senza TURN server, alcune 
          connessioni potrebbero fallire a causa di firewall restrittivi.
        </WarningBox>

        <div className="flex flex-wrap gap-2">
          <Link href="/consultant/calendar-settings">
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
              <Settings className="h-4 w-4" />
              Configura Video Meeting
            </Button>
          </Link>
          <Link href="/consultant/appointments">
            <Button variant="outline" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Vedi Appuntamenti
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuideCalendar() {
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
              <div className="bg-gradient-to-br from-blue-500 to-cyan-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                  Guida Google Calendar
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configura sincronizzazione, appuntamenti e videochiamate in 3 semplici fasi
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Configurazione Iniziale"
              subtitle="Collega Google Calendar e imposta la tua disponibilità"
              icon={Settings}
              gradient="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <WarningBox>
                <strong>IMPORTANTE:</strong> Senza collegare Google Calendar, non potrai sincronizzare 
                appuntamenti né creare link per videochiamate automatiche.
              </WarningBox>

              <StepCard
                number={1}
                title="Collega Google Calendar"
                description="Autorizza l'accesso al tuo account Google per sincronizzare eventi bidirezionalmente."
                icon={Link2}
                iconColor="bg-blue-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
                link="/consultant/calendar-settings"
                linkText="Vai alle Impostazioni"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Clicca "Collega Google Calendar" nelle impostazioni</ChecklistItem>
                  <ChecklistItem>Autorizza l'app con il tuo account Google</ChecklistItem>
                  <ChecklistItem>Seleziona quale calendario usare per le consulenze</ChecklistItem>
                  <ChecklistItem>Verifica che appaia il segno verde di connessione attiva</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Imposta Orari di Lavoro"
                description="Definisci quando sei disponibile per ricevere appuntamenti dai clienti."
                icon={Clock}
                iconColor="bg-cyan-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Imposta orari predefiniti (es: Lun-Ven 9:00-18:00)</ChecklistItem>
                  <ChecklistItem>Blocca giorni per ferie o impegni personali</ChecklistItem>
                  <ChecklistItem>Configura buffer tra appuntamenti (es: 15 minuti)</ChecklistItem>
                  <ChecklistItem>Crea slot personalizzati per giorni specifici</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Configura Sincronizzazione"
                description="Imposta come gli eventi si sincronizzano tra Google Calendar e la piattaforma."
                icon={RefreshCw}
                iconColor="bg-teal-500"
                badge="OPZIONALE"
                badgeVariant="outline"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Sincronizzazione bidirezionale: modifiche in entrambe le direzioni</ChecklistItem>
                  <ChecklistItem>Aggiornamenti in tempo reale automatici</ChecklistItem>
                  <ChecklistItem>Risoluzione conflitti manuale se ci sono sovrapposizioni</ChecklistItem>
                  <ChecklistItem>Possibilità di forzare sync manuale quando necessario</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              title="Gestione Appuntamenti"
              subtitle="Crea, modifica e gestisci consulenze con notifiche automatiche"
              icon={CalendarPlus}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={4}
                title="Crea Nuovo Appuntamento"
                description="Pianifica consulenze con i tuoi clienti direttamente dal calendario."
                icon={CalendarPlus}
                iconColor="bg-green-500"
                badge="BASE"
                badgeVariant="secondary"
                link="/consultant/calendar"
                linkText="Vai al Calendario"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Clicca su uno slot libero nel calendario</ChecklistItem>
                  <ChecklistItem>Seleziona il cliente dalla lista</ChecklistItem>
                  <ChecklistItem>Imposta durata (30min, 1h, 2h)</ChecklistItem>
                  <ChecklistItem>Aggiungi note preparatorie per la consulenza</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Notifiche Automatiche"
                description="Il sistema invia automaticamente email di conferma e promemoria ai partecipanti."
                icon={Bell}
                iconColor="bg-emerald-500"
                badge="AUTOMATICO"
                badgeVariant="outline"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Email di conferma immediata con data, ora e link Meet</ChecklistItem>
                  <ChecklistItem>Promemoria 24 ore prima dell'appuntamento</ChecklistItem>
                  <ChecklistItem>Promemoria 1 ora prima per ridurre no-show</ChecklistItem>
                  <ChecklistItem>Notifica automatica in caso di rescheduling</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={6}
                title="Gestisci Appuntamenti Esistenti"
                description="Modifica, sposta o cancella appuntamenti con aggiornamenti automatici."
                icon={CalendarDays}
                iconColor="bg-lime-500"
                badge="GESTIONE"
                badgeVariant="outline"
                link="/consultant/appointments"
                linkText="Vedi Appuntamenti"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Drag & drop per spostare appuntamenti</ChecklistItem>
                  <ChecklistItem>Click per modificare dettagli</ChecklistItem>
                  <ChecklistItem>Cancellazione con notifica automatica al cliente</ChecklistItem>
                  <ChecklistItem>Cronologia completa di tutte le modifiche</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <VideoMeetingExplainer />

            <SectionCard
              sectionNumber={3}
              title="Video Meeting & TURN Server"
              subtitle="Configura videochiamate stabili con supporto AI Copilot"
              icon={Video}
              gradient="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30"
              borderColor="border-purple-200 dark:border-purple-800"
            >
              <WarningBox>
                <strong>Nota:</strong> Le credenziali Twilio sono necessarie per il TURN server. 
                Senza di esse, le videochiamate potrebbero non funzionare con alcuni client che hanno firewall restrittivi.
              </WarningBox>

              <StepCard
                number={7}
                title="Configura TURN Server (Twilio)"
                description="Il TURN server garantisce connessioni video stabili anche con firewall restrittivi."
                icon={Server}
                iconColor="bg-purple-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
                link="/consultant/calendar-settings"
                linkText="Configura TURN"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Inserisci Account SID Twilio</ChecklistItem>
                  <ChecklistItem>Inserisci Auth Token Twilio</ChecklistItem>
                  <ChecklistItem>Testa la connessione per verificare funzionamento</ChecklistItem>
                  <ChecklistItem>Il sistema userà automaticamente TURN quando necessario</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={8}
                title="Avvia Videochiamata"
                description="Inizia una videochiamata con il cliente direttamente dalla piattaforma."
                icon={Video}
                iconColor="bg-violet-500"
                badge="CHIAMATA"
                badgeVariant="outline"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Dall'appuntamento, clicca "Avvia Video Meeting"</ChecklistItem>
                  <ChecklistItem>Entra nella Green Room per controllo audio/video</ChecklistItem>
                  <ChecklistItem>Attendi che il cliente si colleghi</ChecklistItem>
                  <ChecklistItem>L'AI Copilot si attiva automaticamente durante la chiamata</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={9}
                title="AI Copilot in Chiamata"
                description="Durante la videochiamata, l'AI ti assiste in tempo reale con suggerimenti e analisi."
                icon={Zap}
                iconColor="bg-indigo-500"
                badge="AI"
                badgeVariant="default"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Suggerimenti in tempo reale su cosa dire</ChecklistItem>
                  <ChecklistItem>Analisi del sentiment del cliente</ChecklistItem>
                  <ChecklistItem>Tracking dello script di vendita</ChecklistItem>
                  <ChecklistItem>Note automatiche post-chiamata</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  💡 Link Rapidi
                </CardTitle>
                <CardDescription>Accedi rapidamente alle funzionalità principali</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Link href="/consultant/calendar">
                    <Button variant="outline" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Calendario
                    </Button>
                  </Link>
                  <Link href="/consultant/calendar-settings">
                    <Button variant="outline" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Impostazioni Calendar
                    </Button>
                  </Link>
                  <Link href="/consultant/appointments">
                    <Button variant="outline" className="gap-2">
                      <CalendarDays className="h-4 w-4" />
                      Appuntamenti
                    </Button>
                  </Link>
                  <a 
                    href="https://console.twilio.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                  >
                    <Button variant="outline" className="gap-2">
                      <ExternalLink className="h-4 w-4" />
                      Console Twilio
                    </Button>
                  </a>
                </div>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
              <CardHeader>
                <CardTitle>💡 Consigli per Gestione Tempo Efficace</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span><strong>Time blocking:</strong> Blocca slot per lavoro profondo (es: 9-11 per planning strategico)</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span><strong>Batch simili:</strong> Raggruppa consulenze simili nello stesso giorno per maggiore efficienza</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span><strong>Buffer generosi:</strong> 15-30 minuti tra appuntamenti prevengono ritardi a catena</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-emerald-600">✓</span>
                    <span><strong>Review settimanale:</strong> Ogni domenica rivedi la settimana successiva e prepara materiali</span>
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
