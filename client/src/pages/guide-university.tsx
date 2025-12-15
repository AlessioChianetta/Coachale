import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  GraduationCap, 
  BookOpen, 
  ClipboardList, 
  Award, 
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Layers,
  FileText,
  Target,
  Trophy,
  Star,
  Flame,
  Medal,
  ExternalLink,
  Users,
  PlayCircle,
  ListChecks
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

function GamificationExplainer() {
  return (
    <Card className="bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950/30 dark:to-amber-950/30 border-yellow-200 dark:border-yellow-800 border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-yellow-500 text-white shadow-lg">
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Sistema Gamification - Motiva i Clienti
              <Badge variant="secondary">ENGAGEMENT</Badge>
            </CardTitle>
            <CardDescription>Punti, livelli e badge per mantenere alta la motivazione</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-600" />
              Punti Esperienza (XP)
            </h5>
            <p className="text-sm text-muted-foreground">
              I clienti guadagnano XP completando lezioni, esercizi e mantenendo streak. 
              Più XP = avanzamento di livello.
            </p>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-600" />
              Streak Giornalieri
            </h5>
            <p className="text-sm text-muted-foreground">
              Giorni consecutivi di attività. Gli streak aumentano la motivazione 
              e danno bonus XP.
            </p>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Medal className="h-4 w-4 text-amber-600" />
              Badge e Certificati
            </h5>
            <p className="text-sm text-muted-foreground">
              Riconoscimenti visivi per traguardi raggiunti. 
              Generazione automatica di certificati PDF.
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
          <h5 className="font-semibold mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Livelli di Progressione
          </h5>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
              🌱 Studente - Livello Base
            </Badge>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
              📚 Esperto - 1000+ XP
            </Badge>
            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
              🎯 Mentor - 5000+ XP
            </Badge>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
              👑 Master - 10000+ XP
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href="/consultant/university">
            <Button className="gap-2 bg-yellow-600 hover:bg-yellow-700">
              <GraduationCap className="h-4 w-4" />
              Vai all'Università
            </Button>
          </Link>
          <Link href="/consultant/exercises">
            <Button variant="outline" className="gap-2">
              <ClipboardList className="h-4 w-4" />
              Gestisci Esercizi
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuideUniversity() {
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
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                  Guida La Mia Università
                </h1>
                <p className="text-muted-foreground mt-1">
                  Sistema completo per gestire formazione e crescita dei tuoi clienti
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Struttura dell'Università"
              subtitle="Come è organizzato il sistema formativo: Trimestri, Moduli e Lezioni"
              icon={Layers}
              gradient="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
              borderColor="border-amber-200 dark:border-amber-800"
            >
              <WarningBox>
                <strong>STRUTTURA GERARCHICA:</strong> L'università segue una struttura ordinata: 
                Trimestri → Moduli → Lezioni. I clienti devono completare le lezioni in ordine 
                per sbloccare le successive.
              </WarningBox>

              <StepCard
                number={1}
                title="Trimestri"
                description="L'università è divisa in trimestri tematici. Ogni trimestre copre un'area specifica della formazione."
                icon={Calendar}
                iconColor="bg-amber-500"
                badge="BASE"
                badgeVariant="secondary"
                link="/consultant/university"
                linkText="Vai all'Università"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Ogni trimestre ha un tema specifico (es: Mindset, Strategia, Execution)</ChecklistItem>
                  <ChecklistItem>I trimestri sono sequenziali o assegnabili singolarmente</ChecklistItem>
                  <ChecklistItem>Puoi assegnare trimestri specifici in base al livello del cliente</ChecklistItem>
                  <ChecklistItem>Al completamento del trimestre si genera un certificato</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Moduli"
                description="All'interno di ogni trimestre ci sono moduli tematici. Ogni modulo approfondisce un argomento specifico."
                icon={Layers}
                iconColor="bg-orange-500"
                badge="INTERMEDIO"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Ogni modulo contiene 5-10 lezioni progressive</ChecklistItem>
                  <ChecklistItem>I moduli hanno obiettivi di apprendimento chiari</ChecklistItem>
                  <ChecklistItem>Puoi tracciare il completamento per ogni cliente</ChecklistItem>
                  <ChecklistItem>I moduli possono avere esercizi associati</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Lezioni"
                description="Le lezioni sono l'unità base di apprendimento. Contengono video, documenti e materiali interattivi."
                icon={PlayCircle}
                iconColor="bg-red-500"
                badge="DETTAGLIO"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Ogni lezione dura 10-15 minuti (micro-learning)</ChecklistItem>
                  <ChecklistItem>Può contenere video, PDF, documenti dalla libreria</ChecklistItem>
                  <ChecklistItem>Il cliente marca "completato" quando finisce</ChecklistItem>
                  <ChecklistItem>Le lezioni si sbloccano in ordine progressivo</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              title="Gestione Esercizi"
              subtitle="Come creare, assegnare e valutare esercizi per i tuoi clienti"
              icon={ClipboardList}
              gradient="bg-gradient-to-br from-cyan-50 to-blue-50 dark:from-cyan-950/30 dark:to-blue-950/30"
              borderColor="border-cyan-200 dark:border-cyan-800"
            >
              <StepCard
                number={4}
                title="Template Esercizi"
                description="Usa template predefiniti per creare esercizi standardizzati rapidamente. Ideale per esercizi ricorrenti."
                icon={FileText}
                iconColor="bg-cyan-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
                link="/consultant/exercise-templates"
                linkText="Vedi Template"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Crea template una volta, riusali per ogni cliente</ChecklistItem>
                  <ChecklistItem>I template includono: titolo, descrizione, durata, domande</ChecklistItem>
                  <ChecklistItem>Puoi personalizzare i template al momento dell'assegnazione</ChecklistItem>
                  <ChecklistItem>Organizza i template per categoria (es: Mindset, Finanza, Obiettivi)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Creazione Esercizio"
                description="Crea esercizi personalizzati per ogni cliente con domande, scadenze e criteri di valutazione."
                icon={ClipboardList}
                iconColor="bg-blue-500"
                badge="ESSENZIALE"
                badgeVariant="default"
                link="/consultant/exercises"
                linkText="Crea Esercizio"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Seleziona il cliente destinatario</ChecklistItem>
                  <ChecklistItem>Imposta titolo, descrizione dettagliata</ChecklistItem>
                  <ChecklistItem>Aggiungi domande aperte o a scelta multipla</ChecklistItem>
                  <ChecklistItem>Definisci data di scadenza per mantenere il focus</ChecklistItem>
                  <ChecklistItem>Collega l'esercizio a una lezione specifica (opzionale)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={6}
                title="Assegnazione e Follow-up"
                description="Assegna esercizi ai clienti e monitora il completamento. Invia reminder automatici."
                icon={Target}
                iconColor="bg-indigo-500"
                badge="AUTOMAZIONE"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Gli esercizi vengono notificati via email al cliente</ChecklistItem>
                  <ChecklistItem>Il cliente vede gli esercizi nella sua dashboard</ChecklistItem>
                  <ChecklistItem>Ricevi notifica quando il cliente invia l'esercizio</ChecklistItem>
                  <ChecklistItem>Reminder automatici prima della scadenza</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={7}
                title="Valutazione e Feedback"
                description="Quando il cliente invia l'esercizio, valutalo e fornisci feedback costruttivo per la crescita."
                icon={Award}
                iconColor="bg-purple-500"
                badge="IMPORTANTE"
                badgeVariant="default"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Rivedi le risposte del cliente</ChecklistItem>
                  <ChecklistItem>Assegna un voto (opzionale)</ChecklistItem>
                  <ChecklistItem>Scrivi feedback dettagliato su cosa migliorare</ChecklistItem>
                  <ChecklistItem>Il feedback viene notificato al cliente</ChecklistItem>
                  <ChecklistItem>I voti contribuiscono al punteggio XP del cliente</ChecklistItem>
                </ul>
              </StepCard>

              <WarningBox>
                <strong>BEST PRACTICE:</strong> Ogni lezione dovrebbe avere un esercizio pratico associato. 
                Il rapporto ideale è 1 lezione = 1 esercizio per massimizzare l'apprendimento attivo.
              </WarningBox>
            </SectionCard>

            <GamificationExplainer />

            <SectionCard
              sectionNumber={3}
              title="Tracciamento Progressi"
              subtitle="Monitora l'evoluzione dei clienti con dashboard, certificati e badge"
              icon={TrendingUp}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={8}
                title="Dashboard Progressi"
                description="Ogni cliente ha una dashboard personalizzata che mostra il suo percorso formativo completo."
                icon={TrendingUp}
                iconColor="bg-green-500"
                badge="MONITORAGGIO"
                badgeVariant="secondary"
                link="/consultant/clients"
                linkText="Vedi Clienti"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Lezioni completate vs totali per ogni modulo</ChecklistItem>
                  <ChecklistItem>Esercizi consegnati, in attesa e valutati</ChecklistItem>
                  <ChecklistItem>Media voti e trend di miglioramento</ChecklistItem>
                  <ChecklistItem>Streak giorni consecutivi di attività</ChecklistItem>
                  <ChecklistItem>Livello attuale e XP accumulati</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={9}
                title="Certificati Automatici"
                description="Genera certificati PDF personalizzati quando il cliente completa un trimestre o raggiunge traguardi."
                icon={Award}
                iconColor="bg-emerald-500"
                badge="AUTOMATICO"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Certificato automatico al completamento del trimestre</ChecklistItem>
                  <ChecklistItem>PDF personalizzato con nome cliente e data</ChecklistItem>
                  <ChecklistItem>Include dettaglio moduli e voti ottenuti</ChecklistItem>
                  <ChecklistItem>Il cliente può scaricarlo dalla sua area personale</ChecklistItem>
                  <ChecklistItem>Puoi inviarlo anche via email con un click</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={10}
                title="Badge per Obiettivi"
                description="Assegna badge quando il cliente raggiunge milestone specifici. I badge aumentano la motivazione."
                icon={Medal}
                iconColor="bg-yellow-500"
                badge="GAMIFICATION"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>🔥 Streak Master: 30 giorni consecutivi di attività</ChecklistItem>
                  <ChecklistItem>📚 Studioso: 10 lezioni completate</ChecklistItem>
                  <ChecklistItem>✏️ Praticante: 10 esercizi completati</ChecklistItem>
                  <ChecklistItem>⭐ Eccellenza: Media voti superiore a 8</ChecklistItem>
                  <ChecklistItem>👑 Completatore: Trimestre completato al 100%</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={11}
                title="Report Periodici"
                description="Genera report mensili automatici sui progressi del cliente da condividere nelle consulenze."
                icon={FileText}
                iconColor="bg-teal-500"
                badge="REPORT"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Report automatico mensile via email</ChecklistItem>
                  <ChecklistItem>Confronto con il mese precedente</ChecklistItem>
                  <ChecklistItem>Evidenzia aree di forza e miglioramento</ChecklistItem>
                  <ChecklistItem>Suggerimenti AI su prossimi passi</ChecklistItem>
                  <ChecklistItem>Esportabile come PDF per le consulenze</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListChecks className="h-5 w-5 text-amber-600" />
                  Consigli per Massimizzare l'Apprendimento
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Micro-learning:</strong> Lezioni brevi (10-15 min) hanno completion rate più alto</span></li>
                  <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Esercizi pratici:</strong> Ogni lezione dovrebbe avere un esercizio pratico associato</span></li>
                  <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Feedback costruttivo:</strong> Non dare solo voti, spiega cosa migliorare e come</span></li>
                  <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Celebra i successi:</strong> Riconosci pubblicamente i traguardi per motivare anche gli altri</span></li>
                  <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Streak:</strong> Incoraggia i clienti a mantenere streak per abitudine costante</span></li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border-amber-300 dark:border-amber-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Link Rapidi
                </CardTitle>
                <CardDescription>Accedi velocemente alle sezioni principali</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Link href="/consultant/university">
                    <Button className="gap-2 bg-amber-600 hover:bg-amber-700">
                      <GraduationCap className="h-4 w-4" />
                      Università
                    </Button>
                  </Link>
                  <Link href="/consultant/exercises">
                    <Button variant="outline" className="gap-2">
                      <ClipboardList className="h-4 w-4" />
                      Esercizi
                    </Button>
                  </Link>
                  <Link href="/consultant/exercise-templates">
                    <Button variant="outline" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Template Esercizi
                    </Button>
                  </Link>
                  <Link href="/consultant/clients">
                    <Button variant="outline" className="gap-2">
                      <Users className="h-4 w-4" />
                      Clienti
                    </Button>
                  </Link>
                  <Link href="/consultant/library">
                    <Button variant="outline" className="gap-2">
                      <BookOpen className="h-4 w-4" />
                      Libreria
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
          guideId: "guide-university",
          guideTitle: "Guida La Mia Università",
          guideDescription: "Crea corsi, esercizi e materiali formativi per i tuoi clienti.",
          guideSections: ["Creazione Corsi", "Esercizi", "Assegnazione Clienti"]
        }}
      />
    </div>
  );
}
