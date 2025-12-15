import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  UserPlus, 
  Megaphone, 
  Zap, 
  Settings, 
  FileText, 
  BarChart,
  MessageSquare,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Bot,
  Upload,
  Target,
  TestTube,
  AlertTriangle,
  Clock,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  ListChecks,
  Gauge
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

function TwilioTemplateExplainer() {
  return (
    <Card className="bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 border-violet-200 dark:border-violet-800 border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-violet-500 text-white shadow-lg">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Template Twilio - Guida Completa
              <Badge variant="destructive">FONDAMENTALE</Badge>
            </CardTitle>
            <CardDescription>Senza template approvati da Meta, NON puoi inviare messaggi proattivi</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-600" />
              Cos'è un Template Twilio?
            </h5>
            <p className="text-sm text-muted-foreground">
              È un messaggio pre-approvato da Meta/WhatsApp che puoi usare per contattare i clienti per primo. 
              WhatsApp richiede l'approvazione per prevenire lo spam.
            </p>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Clock className="h-4 w-4 text-violet-600" />
              Processo di Approvazione
            </h5>
            <p className="text-sm text-muted-foreground">
              Dopo aver creato un template, Meta lo rivede in <strong>24-48 ore</strong>. 
              Solo i template con stato "approved" possono essere usati.
            </p>
          </div>
        </div>

        <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
          <h5 className="font-semibold mb-3 flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-violet-600" />
            Stati Possibili del Template
          </h5>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
              <Clock className="h-3 w-3 mr-1" />
              pending - In revisione
            </Badge>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              approved - Pronto all'uso
            </Badge>
            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
              <AlertTriangle className="h-3 w-3 mr-1" />
              rejected - Da correggere
            </Badge>
          </div>
        </div>

        <WarningBox>
          <strong>Attenzione:</strong> Se un template viene rifiutato, controlla il motivo nella console Twilio 
          e correggilo. Motivi comuni: contenuto promozionale troppo aggressivo, mancanza di opt-out, 
          variabili non corrette.
        </WarningBox>

        <div className="flex flex-wrap gap-2">
          <Link href="/consultant/whatsapp-templates">
            <Button className="gap-2 bg-violet-600 hover:bg-violet-700">
              <FileText className="h-4 w-4" />
              Gestisci Template Twilio
            </Button>
          </Link>
          <Link href="/consultant/whatsapp/custom-templates/list">
            <Button variant="outline" className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Template Personalizzati
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

export default function GuideAutomations() {
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
              <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
                  Guida Sistema Automazioni
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configura il sistema di follow-up automatico WhatsApp in 3 semplici fasi
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Prima di Iniziare"
              subtitle="Prerequisiti obbligatori - senza questi il sistema NON funziona"
              icon={ShieldCheck}
              gradient="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30"
              borderColor="border-red-200 dark:border-red-800"
            >
              <WarningBox>
                <strong>IMPORTANTE:</strong> Completa tutti questi passaggi prima di procedere. 
                Senza le credenziali Twilio e i template approvati, il sistema non può inviare messaggi.
              </WarningBox>

              <StepCard
                number={1}
                title="Configura Agente WhatsApp"
                description="Collega il tuo account Twilio per abilitare l'invio e la ricezione di messaggi WhatsApp."
                icon={Bot}
                iconColor="bg-red-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
                link="/consultant/whatsapp"
                linkText="Vai a Setup Agente"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Account Twilio attivo con WhatsApp Business API</ChecklistItem>
                  <ChecklistItem>Account SID e Auth Token recuperati dalla console</ChecklistItem>
                  <ChecklistItem>Numero WhatsApp Business verificato</ChecklistItem>
                  <ChecklistItem>Credenziali inserite nell'agente</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Crea e Approva Template Twilio"
                description="I template sono messaggi pre-approvati da Meta. Senza approvazione, non puoi contattare i clienti per primo."
                icon={FileText}
                iconColor="bg-orange-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
                link="/consultant/whatsapp-templates"
                linkText="Vai a Template Twilio"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Crea almeno un template nella console Twilio</ChecklistItem>
                  <ChecklistItem>Attendi l'approvazione di Meta (24-48h)</ChecklistItem>
                  <ChecklistItem>Verifica stato "approved" nella lista template</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Assegna Template all'Agente"
                description="Collega i template approvati al tuo agente WhatsApp per poterli usare nelle campagne."
                icon={Settings}
                iconColor="bg-amber-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Vai nelle impostazioni dell'agente</ChecklistItem>
                  <ChecklistItem>Seleziona i template da associare</ChecklistItem>
                  <ChecklistItem>Verifica che l'agente abbia almeno un template assegnato</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <TwilioTemplateExplainer />

            <SectionCard
              sectionNumber={2}
              title="Configura il Sistema"
              subtitle="Imposta lead, campagne e regole di automazione"
              icon={Settings}
              gradient="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={4}
                title="Importa Lead Proattivi"
                description="Aggiungi i contatti che vuoi raggiungere. Puoi importarli da file CSV o aggiungerli manualmente."
                icon={Upload}
                iconColor="bg-blue-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
                link="/consultant/proactive-leads"
                linkText="Vai a Lead Proattivi"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Prepara un file CSV con: nome, cognome, telefono (+39...)</ChecklistItem>
                  <ChecklistItem>Clicca "Importa CSV" e carica il file</ChecklistItem>
                  <ChecklistItem>Oppure usa "Aggiungi Manualmente" per singoli lead</ChecklistItem>
                  <ChecklistItem>Aggiungi tag per organizzare i lead (es: "evento2024", "newsletter")</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Crea Campagne per Invio Massivo"
                description="Le campagne inviano il primo messaggio ai tuoi lead selezionati usando i template approvati."
                icon={Megaphone}
                iconColor="bg-purple-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
                link="/consultant/campaigns"
                linkText="Vai a Campagne"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Clicca "Nuova Campagna"</ChecklistItem>
                  <ChecklistItem>Seleziona i lead da contattare (filtra per tag se necessario)</ChecklistItem>
                  <ChecklistItem>Scegli il template approvato da usare</ChecklistItem>
                  <ChecklistItem>Pianifica l'invio: immediato o programmato</ChecklistItem>
                  <ChecklistItem>Inizia con pochi lead per testare!</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={6}
                title="Configura Regole di Follow-up"
                description="Le regole inviano automaticamente messaggi di follow-up basandosi su tempo e comportamento."
                icon={Zap}
                iconColor="bg-indigo-500"
                badge="OPZIONALE"
                badgeVariant="outline"
                link="/consultant/automations"
                linkText="Vai a Automazioni"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Esempio: "Se nessuna risposta dopo 24h → invia reminder"</ChecklistItem>
                  <ChecklistItem>Imposta trigger temporali o basati su eventi</ChecklistItem>
                  <ChecklistItem>Scegli il template da inviare</ChecklistItem>
                  <ChecklistItem>Limita il numero massimo di tentativi</ChecklistItem>
                  <ChecklistItem>Usa "Crea con AI" per regole complesse</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={7}
                title="Prepara Template Messaggi Personalizzati"
                description="Crea template interni per i follow-up automatici e le risposte dell'agente AI."
                icon={FileText}
                iconColor="bg-cyan-500"
                badge="OPZIONALE"
                badgeVariant="outline"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Vai nella sezione Template delle Automazioni</ChecklistItem>
                  <ChecklistItem>Usa variabili: {"{{nome}}"}, {"{{data}}"}, {"{{prodotto}}"}</ChecklistItem>
                  <ChecklistItem>Crea template diversi per ogni fase del funnel</ChecklistItem>
                  <ChecklistItem>Testa il rendering delle variabili prima dell'uso</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              title="Monitora e Ottimizza"
              subtitle="Gestisci le conversazioni attive e analizza i risultati"
              icon={Gauge}
              gradient="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30"
              borderColor="border-emerald-200 dark:border-emerald-800"
            >
              <StepCard
                number={8}
                title="Monitora Pipeline Conversazioni"
                description="Visualizza tutte le conversazioni attive organizzate per stato nel kanban."
                icon={Target}
                iconColor="bg-emerald-500"
                link="/consultant/automations"
                linkText="Vai a Pipeline"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Visualizza lo stato di ogni conversazione</ChecklistItem>
                  <ChecklistItem>Sposta manualmente i lead tra le colonne</ChecklistItem>
                  <ChecklistItem>Rispondi direttamente dalla chat se necessario</ChecklistItem>
                  <ChecklistItem>Identifica i lead più promettenti</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={9}
                title="Controlla Analytics"
                description="Analizza le performance delle tue campagne e automazioni."
                icon={BarChart}
                iconColor="bg-teal-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Messaggi inviati, consegnati, letti</ChecklistItem>
                  <ChecklistItem>Tasso di risposta per campagna</ChecklistItem>
                  <ChecklistItem>Conversioni e appuntamenti fissati</ChecklistItem>
                  <ChecklistItem>Performance delle regole automatiche</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={10}
                title="Testa il Sistema"
                description="Prima di usare il sistema con i clienti reali, testalo con il tuo numero."
                icon={TestTube}
                iconColor="bg-green-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <h5 className="font-medium mb-3 flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-green-600" />
                    Checklist di Test
                  </h5>
                  <div className="grid gap-2 md:grid-cols-2">
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center text-xs font-bold text-green-600">1</div>
                      <span>Aggiungi te stesso come lead di test</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center text-xs font-bold text-green-600">2</div>
                      <span>Crea una campagna con solo il tuo lead</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center text-xs font-bold text-green-600">3</div>
                      <span>Invia e verifica di ricevere il messaggio</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center text-xs font-bold text-green-600">4</div>
                      <span>Rispondi e controlla la pipeline</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center text-xs font-bold text-green-600">5</div>
                      <span>Crea una regola di test</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <div className="w-5 h-5 rounded-full border-2 border-green-500 flex items-center justify-center text-xs font-bold text-green-600">6</div>
                      <span>Verifica il follow-up automatico</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-green-100/80 dark:bg-green-950/40 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-semibold text-green-800 dark:text-green-200">Sistema Pronto!</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    Se tutti i test sono passati, il sistema è configurato correttamente. 
                    Puoi iniziare a importare i lead reali e avviare le campagne.
                  </p>
                </div>
              </StepCard>
            </SectionCard>

            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-indigo-600" />
                  Accesso Rapido
                </CardTitle>
                <CardDescription>
                  Vai direttamente alle pagine più importanti del sistema
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Link href="/consultant/whatsapp">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-950/30">
                      <Bot className="h-5 w-5 text-red-500" />
                      <div className="text-left">
                        <div className="font-medium">Setup Agente WhatsApp</div>
                        <div className="text-xs text-muted-foreground">Configura credenziali Twilio</div>
                      </div>
                    </Button>
                  </Link>
                  
                  <Link href="/consultant/whatsapp-templates">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4 hover:bg-orange-50 hover:border-orange-300 dark:hover:bg-orange-950/30">
                      <FileText className="h-5 w-5 text-orange-500" />
                      <div className="text-left">
                        <div className="font-medium">Template Twilio</div>
                        <div className="text-xs text-muted-foreground">Gestisci template approvati</div>
                      </div>
                    </Button>
                  </Link>
                  
                  <Link href="/consultant/proactive-leads">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30">
                      <UserPlus className="h-5 w-5 text-blue-500" />
                      <div className="text-left">
                        <div className="font-medium">Lead Proattivi</div>
                        <div className="text-xs text-muted-foreground">Importa e gestisci contatti</div>
                      </div>
                    </Button>
                  </Link>
                  
                  <Link href="/consultant/campaigns">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4 hover:bg-purple-50 hover:border-purple-300 dark:hover:bg-purple-950/30">
                      <Megaphone className="h-5 w-5 text-purple-500" />
                      <div className="text-left">
                        <div className="font-medium">Campagne</div>
                        <div className="text-xs text-muted-foreground">Crea invii massivi</div>
                      </div>
                    </Button>
                  </Link>
                  
                  <Link href="/consultant/automations">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4 hover:bg-indigo-50 hover:border-indigo-300 dark:hover:bg-indigo-950/30">
                      <Zap className="h-5 w-5 text-indigo-500" />
                      <div className="text-left">
                        <div className="font-medium">Automazioni</div>
                        <div className="text-xs text-muted-foreground">Pipeline e regole follow-up</div>
                      </div>
                    </Button>
                  </Link>
                  
                  <Link href="/consultant/whatsapp/custom-templates/list">
                    <Button variant="outline" className="w-full justify-start gap-3 h-auto py-4 hover:bg-teal-50 hover:border-teal-300 dark:hover:bg-teal-950/30">
                      <MessageSquare className="h-5 w-5 text-teal-500" />
                      <div className="text-left">
                        <div className="font-medium">Template Personalizzati</div>
                        <div className="text-xs text-muted-foreground">Crea template interni</div>
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
