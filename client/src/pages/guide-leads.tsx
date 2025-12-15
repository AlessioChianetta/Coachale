import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Upload,
  Tag,
  Filter,
  Calendar,
  RefreshCw,
  Search,
  Users
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
  totalSections,
  title,
  subtitle,
  icon: Icon
}: { 
  children: React.ReactNode;
  gradient: string;
  borderColor: string;
  sectionNumber: number;
  totalSections: number;
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
          <ProgressIndicator current={sectionNumber} total={totalSections} />
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

export default function GuideLeads() {
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
                  Guida CRM Lead Proattivi
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gestione completa dei lead: importazione, stati, tag e schedulazione
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              totalSections={5}
              title="Importare Lead da CSV"
              subtitle="Come caricare una lista di lead da file"
              icon={Upload}
              gradient="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={1}
                title="Vai su Lead Proattivi"
                description="Accedi alla sezione Lead per gestire tutti i tuoi contatti."
                icon={Users}
                iconColor="bg-blue-500"
                link="/consultant/proactive-leads"
                linkText="Gestisci Lead"
              />

              <StepCard
                number={2}
                title="Clicca 'Importa CSV'"
                description="In alto trovi il bottone 'Importa' o 'Importa CSV'. Clicca per aprire il dialogo di importazione."
                icon={Upload}
                iconColor="bg-cyan-500"
              />

              <StepCard
                number={3}
                title="Formato CSV richiesto"
                description="Il file CSV deve avere queste colonne obbligatorie e opzionali."
                icon={CheckCircle2}
                iconColor="bg-teal-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ul className="space-y-1 text-sm">
                    <li><strong>Nome</strong> (obbligatorio)</li>
                    <li><strong>Cognome</strong> (opzionale)</li>
                    <li><strong>Telefono</strong> (obbligatorio, formato: +39...)</li>
                    <li><strong>Email</strong> (opzionale)</li>
                    <li><strong>Note</strong> (opzionale)</li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Seleziona campagna"
                description="Durante l'import puoi assegnare tutti i lead a una campagna. I lead erediteranno automaticamente uncino, obiettivi e template della campagna."
                icon={Tag}
                iconColor="bg-indigo-500"
              />

              <WarningBox>
                Il sistema rileva automaticamente lead duplicati (stesso numero di telefono) e ti chiede se sovrascriverli o saltarli.
              </WarningBox>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              totalSections={5}
              title="Aggiungere Lead Manualmente"
              subtitle="Come inserire singoli lead uno alla volta"
              icon={UserPlus}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={1}
                title="Clicca 'Nuovo Lead'"
                description="Nella pagina Lead Proattivi, clicca il bottone 'Nuovo Lead' o '+' in alto a destra."
                icon={UserPlus}
                iconColor="bg-green-500"
              />

              <StepCard
                number={2}
                title="Compila i campi"
                description="Inserisci tutte le informazioni del lead."
                icon={CheckCircle2}
                iconColor="bg-emerald-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Nome e Cognome</ChecklistItem>
                  <ChecklistItem>Numero telefono (formato internazionale)</ChecklistItem>
                  <ChecklistItem>Email (opzionale)</ChecklistItem>
                  <ChecklistItem>Campagna di appartenenza</ChecklistItem>
                  <ChecklistItem>Note aggiuntive</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Programma contatto"
                description="Puoi impostare quando contattare il lead."
                icon={Clock}
                iconColor="bg-teal-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Subito - Messaggio immediato
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    Data/ora - Schedulato
                  </Badge>
                  <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">
                    In attesa - Manuale
                  </Badge>
                </div>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              totalSections={5}
              title="Gestione Stati Lead"
              subtitle="Capire e gestire i diversi stati dei lead"
              icon={RefreshCw}
              gradient="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30"
              borderColor="border-purple-200 dark:border-purple-800"
            >
              <StepCard
                number={1}
                title="Stati disponibili"
                description="Ogni lead passa attraverso diversi stati durante il processo di contatto."
                icon={RefreshCw}
                iconColor="bg-purple-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    Pending - Non ancora contattato
                  </Badge>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    Contacted - Primo messaggio inviato
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Responded - Il lead ha risposto
                  </Badge>
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300">
                    Converted - Diventato cliente
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    Disqualified - Non in target
                  </Badge>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Transizioni automatiche"
                description="Il sistema aggiorna automaticamente lo stato in base alle interazioni."
                icon={ArrowRight}
                iconColor="bg-violet-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="text-yellow-600">Pending</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-blue-600">Contacted</span>
                      <span className="text-muted-foreground ml-2">quando invii il primo messaggio</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="text-blue-600">Contacted</span>
                      <ArrowRight className="h-3 w-3" />
                      <span className="text-green-600">Responded</span>
                      <span className="text-muted-foreground ml-2">quando il lead risponde</span>
                    </li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={3}
                title="Cambiare stato manualmente"
                description="Clicca sul lead, poi sul menu a tendina 'Stato' per cambiarlo manualmente. Utile per segnare conversioni offline o disqualificare lead."
                icon={CheckCircle2}
                iconColor="bg-indigo-500"
              />
            </SectionCard>

            <SectionCard
              sectionNumber={4}
              totalSections={5}
              title="Tag e Filtri"
              subtitle="Organizzare i lead con tag e filtri avanzati"
              icon={Tag}
              gradient="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
              borderColor="border-orange-200 dark:border-orange-800"
            >
              <StepCard
                number={1}
                title="Aggiungere tag"
                description="Ogni lead puo avere tag personalizzati per organizzare i contatti."
                icon={Tag}
                iconColor="bg-orange-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary">Facebook Ads</Badge>
                  <Badge variant="secondary">Hot Lead</Badge>
                  <Badge variant="secondary">Richiamato</Badge>
                  <Badge variant="secondary">Evento 2024</Badge>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Filtri disponibili"
                description="Usa i filtri per trovare rapidamente i lead che ti interessano."
                icon={Filter}
                iconColor="bg-amber-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem checked>Filtro per tag</ChecklistItem>
                  <ChecklistItem checked>Filtro per campagna</ChecklistItem>
                  <ChecklistItem checked>Filtro per stato</ChecklistItem>
                  <ChecklistItem checked>Ricerca testuale (nome, telefono, note)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Ricerca testuale"
                description="La barra di ricerca cerca in nome, cognome, telefono e note. Trova rapidamente qualsiasi lead."
                icon={Search}
                iconColor="bg-yellow-500"
              />
            </SectionCard>

            <SectionCard
              sectionNumber={5}
              totalSections={5}
              title="Schedulazione Contatto"
              subtitle="Programmare quando contattare i lead"
              icon={Calendar}
              gradient="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30"
              borderColor="border-teal-200 dark:border-teal-800"
            >
              <StepCard
                number={1}
                title="Contatto immediato"
                description="Per lead 'caldi' (appena arrivati da form), imposta contatto immediato. Il primo messaggio parte subito."
                icon={Clock}
                iconColor="bg-teal-500"
                badge="CONSIGLIATO PER LEAD CALDI"
                badgeVariant="secondary"
              />

              <StepCard
                number={2}
                title="Contatto programmato"
                description="Per lead 'freddi' o liste importate, schedula il contatto per data/ora specifica."
                icon={Calendar}
                iconColor="bg-cyan-500"
              />

              <StepCard
                number={3}
                title="Distribuzione temporale"
                description="Quando importi molti lead, il sistema puo distribuirli nel tempo per evitare di inviare troppi messaggi insieme (es: 10 lead ogni ora)."
                icon={RefreshCw}
                iconColor="bg-blue-500"
              />

              <WarningBox>
                Il sistema rispetta gli orari di lavoro dell'agente. Se programmi un contatto alle 23:00 ma l'agente lavora 9-18, il messaggio partira alle 9:00 del giorno dopo.
              </WarningBox>
            </SectionCard>

            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-blue-600" />
                  Accesso Rapido
                </CardTitle>
                <CardDescription>
                  Vai direttamente alla gestione lead
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="/consultant/proactive-leads">
                    <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Lead Proattivi</div>
                        <div className="text-xs text-muted-foreground">Gestisci tutti i tuoi lead</div>
                      </div>
                    </Button>
                  </Link>
                  <Link href="/consultant/campaigns">
                    <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                      <Tag className="h-5 w-5 text-purple-600" />
                      <div className="text-left">
                        <div className="font-medium">Campagne</div>
                        <div className="text-xs text-muted-foreground">Gestisci le campagne marketing</div>
                      </div>
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
