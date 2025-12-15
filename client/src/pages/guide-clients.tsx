import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  Target, 
  Calendar, 
  BarChart3, 
  BookOpen,
  UserPlus,
  FileText,
  Mail,
  MessageSquare,
  TrendingUp,
  Award,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Sparkles,
  UserCheck,
  CalendarCheck,
  BellRing,
  PieChart,
  Milestone,
  ExternalLink
} from "lucide-react";
import { Link } from "wouter";
import { GuideFloatingAssistant } from "@/components/ai-assistant/GuideFloatingAssistant";

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

function BestPracticesCard() {
  return (
    <Card className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 border-purple-200 dark:border-purple-800 border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-purple-500 text-white shadow-lg">
            <Sparkles className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Best Practices Gestione Clienti
              <Badge variant="secondary">CONSIGLI PRO</Badge>
            </CardTitle>
            <CardDescription>Suggerimenti per massimizzare l'efficacia con i tuoi clienti</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <FileText className="h-4 w-4 text-purple-600" />
              Documenta Tutto
            </h5>
            <p className="text-sm text-muted-foreground">
              Note dettagliate oggi ti fanno risparmiare ore domani. Ogni interazione merita una nota.
            </p>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-purple-600" />
              Check-in Regolari
            </h5>
            <p className="text-sm text-muted-foreground">
              Brevi check-in settimanali sono più efficaci di lunghe sessioni mensili.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-purple-600" />
              Celebra i Piccoli Win
            </h5>
            <p className="text-sm text-muted-foreground">
              Riconosci ogni progresso, non solo i grandi traguardi. La motivazione cresce con i riconoscimenti.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-purple-600" />
              Sii Proattivo
            </h5>
            <p className="text-sm text-muted-foreground">
              Anticipa problemi e bisogni del cliente prima che te li chieda.
            </p>
          </div>
        </div>

        <WarningBox>
          <strong>Ricorda:</strong> Un cliente ben seguito è un cliente che resta. 
          Investi tempo nella relazione e nella documentazione accurata di ogni interazione.
        </WarningBox>
      </CardContent>
    </Card>
  );
}

export default function GuideClients() {
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
              <div className="bg-gradient-to-br from-purple-500 to-pink-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Guida Gestione Clienti
                </h1>
                <p className="text-muted-foreground mt-1">
                  Tutto quello che serve per gestire i tuoi clienti efficacemente in 3 sezioni
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Gestione Clienti"
              subtitle="Anagrafica, profili e stati - la base di tutto"
              icon={Users}
              gradient="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30"
              borderColor="border-purple-200 dark:border-purple-800"
            >
              <StepCard
                number={1}
                title="Aggiungi Nuovo Cliente"
                description="Crea il profilo completo del tuo cliente con tutte le informazioni necessarie per seguirlo al meglio."
                icon={UserPlus}
                iconColor="bg-purple-500"
                badge="FONDAMENTALE"
                badgeVariant="destructive"
                link="/consultant/clients"
                linkText="Vai a Gestione Clienti"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem checked>Vai su Clienti → Aggiungi Cliente</ChecklistItem>
                  <ChecklistItem checked>Inserisci nome, email, telefono</ChecklistItem>
                  <ChecklistItem>Aggiungi informazioni aggiuntive (azienda, ruolo, note)</ChecklistItem>
                  <ChecklistItem>Assegna tag per categorizzazione (VIP, Nuovo, Attivo)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Profilo Cliente Completo"
                description="Ogni cliente ha un profilo dettagliato con tutte le informazioni e la cronologia delle interazioni."
                icon={UserCheck}
                iconColor="bg-violet-500"
                badge="IMPORTANTE"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Dati anagrafici completi e contatti</ChecklistItem>
                  <ChecklistItem>Stato attuale del percorso</ChecklistItem>
                  <ChecklistItem>Obiettivi personali e professionali</ChecklistItem>
                  <ChecklistItem>Storico consulenze e sessioni</ChecklistItem>
                  <ChecklistItem>Esercizi assegnati e completati</ChecklistItem>
                  <ChecklistItem>Note e cronologia interazioni</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Tracciamento Stato Cliente"
                description="Definisci dove si trova il cliente oggi e dove vuole arrivare. Traccia i progressi nel tempo."
                icon={Target}
                iconColor="bg-indigo-500"
                badge="STRATEGICO"
                badgeVariant="secondary"
                link="/consultant/client-state"
                linkText="Gestisci Stati"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Definisci stato attuale (es: "Fatturato 50k/anno, stress alto")</ChecklistItem>
                  <ChecklistItem>Imposta stato ideale (es: "Fatturato 100k/anno, work-life balance")</ChecklistItem>
                  <ChecklistItem>Identifica ostacoli principali</ChecklistItem>
                  <ChecklistItem>Aggiorna regolarmente dopo ogni consulenza</ChecklistItem>
                </ul>
              </StepCard>

              <WarningBox>
                <strong>Consiglio:</strong> Aggiorna lo stato del cliente dopo ogni sessione. 
                Tracciare i progressi ti permette di mostrare risultati tangibili e mantenere alta la motivazione.
              </WarningBox>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              title="Comunicazione"
              subtitle="Email, appuntamenti e task - resta sempre connesso"
              icon={MessageSquare}
              gradient="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={4}
                title="Gestione Appuntamenti"
                description="Programma consulenze e sincronizza con Google Calendar per non perdere mai un appuntamento."
                icon={CalendarCheck}
                iconColor="bg-blue-500"
                badge="ESSENZIALE"
                badgeVariant="destructive"
                link="/consultant/appointments"
                linkText="Vedi Appuntamenti"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem checked>Crea appuntamento con data, ora e durata</ChecklistItem>
                  <ChecklistItem checked>Specifica tipo di consulenza</ChecklistItem>
                  <ChecklistItem>Sincronizza con Google Calendar</ChecklistItem>
                  <ChecklistItem>Prepara note pre-consulenza</ChecklistItem>
                  <ChecklistItem>Genera riepilogo post-consulenza con AI</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Task e Compiti"
                description="Assegna task post-consulenza e monitora il completamento. Tieni alta l'accountability."
                icon={ClipboardList}
                iconColor="bg-cyan-500"
                badge="ENGAGEMENT"
                badgeVariant="secondary"
                link="/consultant/client-daily"
                linkText="Gestisci Task"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Crea task specifici per ogni cliente</ChecklistItem>
                  <ChecklistItem>Imposta priorità: Urgente, Alta, Media, Bassa</ChecklistItem>
                  <ChecklistItem>Monitora completion rate</ChecklistItem>
                  <ChecklistItem>Raccogli riflessioni giornaliere del cliente</ChecklistItem>
                </ul>
                <div className="bg-cyan-50 dark:bg-cyan-950/40 rounded-lg p-3 mt-3 border border-cyan-200 dark:border-cyan-800">
                  <p className="text-sm text-cyan-800 dark:text-cyan-200">
                    <strong>Riflessioni giornaliere:</strong> Il cliente può inserire 3 cose per cui è grato, 
                    obiettivi del giorno e cosa migliorare.
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={6}
                title="Comunicazione Email"
                description="Invia email personalizzate e automatiche per mantenere il contatto tra le sessioni."
                icon={Mail}
                iconColor="bg-teal-500"
                badge="FOLLOW-UP"
                badgeVariant="secondary"
                link="/consultant/email-logs"
                linkText="Vedi Email Inviate"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Email di benvenuto automatiche</ChecklistItem>
                  <ChecklistItem>Reminder appuntamenti</ChecklistItem>
                  <ChecklistItem>Riepilogo post-consulenza generato da AI</ChecklistItem>
                  <ChecklistItem>Follow-up personalizzati</ChecklistItem>
                  <ChecklistItem>Newsletter e contenuti formativi</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              title="Analytics e Progressi"
              subtitle="Metriche, report e roadmap - misura i risultati"
              icon={BarChart3}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={7}
                title="Dashboard Metriche"
                description="Visualizza le performance di ogni cliente con metriche chiave e grafici di evoluzione."
                icon={PieChart}
                iconColor="bg-green-500"
                badge="INSIGHTS"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Completion rate esercizi</ChecklistItem>
                  <ChecklistItem>Streak giorni attivo</ChecklistItem>
                  <ChecklistItem>Progressi università/formazione</ChecklistItem>
                  <ChecklistItem>Confronta periodi (mese vs mese, trimestre vs trimestre)</ChecklistItem>
                  <ChecklistItem>Identifica pattern e correlazioni</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={8}
                title="Roadmap Personalizzata"
                description="Ogni cliente ha una roadmap con fasi, gruppi e item da completare nel suo percorso."
                icon={Milestone}
                iconColor="bg-emerald-500"
                badge="PERCORSO"
                badgeVariant="secondary"
                link="/consultant/roadmap"
                linkText="Vedi Roadmap"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Visualizza roadmap Orbitale con fasi e gruppi</ChecklistItem>
                  <ChecklistItem>Segna progressi e item completati</ChecklistItem>
                  <ChecklistItem>Aggiungi note e voti per ogni item</ChecklistItem>
                  <ChecklistItem>Celebra milestone raggiunte</ChecklistItem>
                  <ChecklistItem>Pianifica fasi successive</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={9}
                title="Report Automatici"
                description="Genera report mensili e trimestrali da condividere con il cliente per mostrare progressi tangibili."
                icon={TrendingUp}
                iconColor="bg-lime-500"
                badge="VALORE"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Report mensili automatici</ChecklistItem>
                  <ChecklistItem>Analisi trimestrale dei progressi</ChecklistItem>
                  <ChecklistItem>Grafici evoluzione nel tempo</ChecklistItem>
                  <ChecklistItem>Export PDF da condividere</ChecklistItem>
                  <ChecklistItem>Evidenzia successi e aree di miglioramento</ChecklistItem>
                </ul>
              </StepCard>

              <WarningBox>
                <strong>Importante:</strong> Condividi regolarmente i report con i tuoi clienti. 
                Vedere i propri progressi documentati aumenta la motivazione e rafforza la fiducia nel percorso.
              </WarningBox>
            </SectionCard>

            <BestPracticesCard />

            <Card className="border-gray-200 dark:border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Link Rapidi
                </CardTitle>
                <CardDescription>Accedi velocemente alle sezioni più usate</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Link href="/consultant/clients">
                    <Button variant="outline" className="gap-2">
                      <Users className="h-4 w-4" />
                      Gestione Clienti
                    </Button>
                  </Link>
                  <Link href="/consultant/client-state">
                    <Button variant="outline" className="gap-2">
                      <Target className="h-4 w-4" />
                      Stati Clienti
                    </Button>
                  </Link>
                  <Link href="/consultant/appointments">
                    <Button variant="outline" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Appuntamenti
                    </Button>
                  </Link>
                  <Link href="/consultant/client-daily">
                    <Button variant="outline" className="gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Task & Daily
                    </Button>
                  </Link>
                  <Link href="/consultant/roadmap">
                    <Button variant="outline" className="gap-2">
                      <Milestone className="h-4 w-4" />
                      Roadmap
                    </Button>
                  </Link>
                  <Link href="/consultant/email-logs">
                    <Button variant="outline" className="gap-2">
                      <Mail className="h-4 w-4" />
                      Email Log
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
      <GuideFloatingAssistant 
        guideContext={{
          guideId: "guide-clients",
          guideTitle: "Guida Gestione Clienti",
          guideDescription: "Gestisci i tuoi clienti, traccia il loro stato e monitora le attività quotidiane.",
          guideSections: ["Aggiunta Clienti", "Stato Clienti", "Daily Feedback", "Roadmap"]
        }}
      />
    </div>
  );
}
