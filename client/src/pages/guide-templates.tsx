import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Bot,
  AlertTriangle,
  Clock,
  ChevronRight,
  Send,
  Edit3,
  Link2,
  MessageSquare
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

export default function GuideTemplates() {
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
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-purple-600 bg-clip-text text-transparent">
                  Guida Template WhatsApp
                </h1>
                <p className="text-muted-foreground mt-1">
                  Gestisci template Twilio e template custom per messaggi WhatsApp
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              totalSections={3}
              title="Template Twilio (Per Messaggi Proattivi)"
              subtitle="Template approvati da Twilio per inviare il primo messaggio ai lead"
              icon={Send}
              gradient="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30"
              borderColor="border-violet-200 dark:border-violet-800"
            >
              <WarningBox>
                <strong>IMPORTANTE:</strong> Per inviare il PRIMO messaggio a un lead su WhatsApp (messaggio proattivo), 
                Twilio richiede l'uso di template pre-approvati. Senza approvazione, non puoi contattare i lead per primo.
              </WarningBox>

              <StepCard
                number={1}
                title="Vai su Template WhatsApp"
                description="Accedi alla sezione Template Twilio per gestire i tuoi template approvati."
                icon={FileText}
                iconColor="bg-violet-500"
                link="/consultant/whatsapp-templates"
                linkText="Gestisci Template Twilio"
              />

              <StepCard
                number={2}
                title="Creare un nuovo template"
                description="Clicca 'Nuovo Template' e compila tutti i campi richiesti."
                icon={Edit3}
                iconColor="bg-purple-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Nome template: identificativo univoco</ChecklistItem>
                  <ChecklistItem>Categoria: Marketing, Utility, Authentication</ChecklistItem>
                  <ChecklistItem>Lingua: it, en, ecc.</ChecklistItem>
                  <ChecklistItem>Corpo del messaggio: testo con variabili {"{{1}}"}, {"{{2}}"}, ecc.</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Stati del template"
                description="Ogni template passa attraverso un processo di approvazione da parte di WhatsApp/Twilio."
                icon={Clock}
                iconColor="bg-indigo-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending - In attesa approvazione
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Approved - Pronto all'uso
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Rejected - Da modificare
                  </Badge>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Best Practices"
                description="Segui queste linee guida per aumentare le probabilità di approvazione."
                icon={CheckCircle2}
                iconColor="bg-green-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem checked>Usa un linguaggio chiaro e non spam</ChecklistItem>
                  <ChecklistItem checked>Evita promesse irrealistiche</ChecklistItem>
                  <ChecklistItem checked>Includi un modo per l'utente di cancellarsi</ChecklistItem>
                  <ChecklistItem checked>Non usare tutto maiuscolo</ChecklistItem>
                  <ChecklistItem>Evita contenuti promozionali aggressivi</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              totalSections={3}
              title="Template Custom (Personalizzati)"
              subtitle="Template interni con variabili dinamiche per follow-up e risposte"
              icon={Edit3}
              gradient="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={1}
                title="Vai su Template Custom"
                description="Accedi alla gestione dei template personalizzati per l'uso interno."
                icon={MessageSquare}
                iconColor="bg-blue-500"
                link="/consultant/whatsapp/custom-templates/list"
                linkText="Gestisci Template Custom"
              />

              <StepCard
                number={2}
                title="Differenza con Template Twilio"
                description="I Template Custom sono per uso INTERNO nell'app e non richiedono approvazione."
                icon={FileText}
                iconColor="bg-cyan-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem checked>Non richiedono approvazione Twilio</ChecklistItem>
                  <ChecklistItem checked>Usati per follow-up (dopo che il lead ha risposto)</ChecklistItem>
                  <ChecklistItem checked>Contengono variabili dinamiche personalizzate</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Variabili disponibili"
                description="Usa queste variabili nel testo del messaggio per personalizzare ogni invio."
                icon={Edit3}
                iconColor="bg-teal-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ul className="space-y-1 text-sm font-mono">
                    <li><span className="text-blue-600">{"{nome_lead}"}</span> = Nome del contatto</li>
                    <li><span className="text-blue-600">{"{cognome_lead}"}</span> = Cognome</li>
                    <li><span className="text-blue-600">{"{uncino}"}</span> = Uncino della campagna</li>
                    <li><span className="text-blue-600">{"{obiettivi}"}</span> = Obiettivi stato ideale</li>
                    <li><span className="text-blue-600">{"{desideri}"}</span> = Desideri impliciti</li>
                    <li><span className="text-blue-600">{"{nome_consulente}"}</span> = Il tuo nome</li>
                  </ul>
                </div>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              totalSections={3}
              title="Assegnazione Template agli Agenti"
              subtitle="Come collegare template agli agenti WhatsApp"
              icon={Bot}
              gradient="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30"
              borderColor="border-emerald-200 dark:border-emerald-800"
            >
              <StepCard
                number={1}
                title="Template di default agente"
                description="Ogni agente WhatsApp può avere template predefiniti che usa automaticamente per i messaggi di apertura e follow-up."
                icon={Bot}
                iconColor="bg-emerald-500"
                link="/consultant/whatsapp"
                linkText="Vai agli Agenti"
              />

              <StepCard
                number={2}
                title="Assegnare template a campagna"
                description="Quando crei una campagna marketing, puoi selezionare quali template usare. La campagna sovrascrive i template di default dell'agente."
                icon={Link2}
                iconColor="bg-green-500"
                link="/consultant/campaigns"
                linkText="Vai alle Campagne"
              />

              <StepCard
                number={3}
                title="Priorita template"
                description="Ordine di priorita nell'uso dei template."
                icon={ArrowRight}
                iconColor="bg-teal-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ol className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">1</span>
                      Template specifico della campagna (se configurato)
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">2</span>
                      Template di default dell'agente
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-gray-500 text-white flex items-center justify-center text-xs font-bold">3</span>
                      Template generico del sistema
                    </li>
                  </ol>
                </div>
              </StepCard>
            </SectionCard>

            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-violet-600" />
                  Accesso Rapido
                </CardTitle>
                <CardDescription>
                  Vai direttamente alle pagine dei template
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="/consultant/whatsapp-templates">
                    <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                      <Send className="h-5 w-5 text-violet-600" />
                      <div className="text-left">
                        <div className="font-medium">Template Twilio</div>
                        <div className="text-xs text-muted-foreground">Template per messaggi proattivi</div>
                      </div>
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp/custom-templates/list">
                    <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                      <Edit3 className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Template Custom</div>
                        <div className="text-xs text-muted-foreground">Template personalizzati</div>
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
