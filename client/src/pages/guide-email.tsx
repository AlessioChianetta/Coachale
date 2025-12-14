import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Mail, 
  Settings, 
  Inbox, 
  Sparkles, 
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ExternalLink,
  ChevronRight,
  Server,
  Key,
  Send,
  FileText,
  BarChart,
  Calendar,
  Zap
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

function SMTPProviderExplainer() {
  return (
    <Card className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-sky-200 dark:border-sky-800 border-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-sky-500 text-white shadow-lg">
            <Server className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="flex items-center gap-2">
              Provider SMTP - Guida Rapida
              <Badge variant="secondary">INFO</Badge>
            </CardTitle>
            <CardDescription>Quale servizio email scegliere per il tuo business</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4 text-red-500" />
              Gmail
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              Facile da configurare. Limite 500 email/giorno.
            </p>
            <Badge variant="outline" className="text-xs">Ideale per iniziare</Badge>
          </div>
          
          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Zap className="h-4 w-4 text-orange-500" />
              Amazon SES
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              Economico e scalabile. $0.10 per 1000 email.
            </p>
            <Badge variant="outline" className="text-xs">Volumi elevati</Badge>
          </div>

          <div className="bg-white/80 dark:bg-gray-900/80 rounded-lg p-4 border">
            <h5 className="font-semibold mb-2 flex items-center gap-2">
              <Send className="h-4 w-4 text-purple-500" />
              Resend / SendGrid
            </h5>
            <p className="text-sm text-muted-foreground mb-2">
              API moderne, facili da integrare.
            </p>
            <Badge variant="outline" className="text-xs">Developer-friendly</Badge>
          </div>
        </div>

        <WarningBox>
          <strong>Consiglio:</strong> Inizia con Gmail per testare, poi passa ad Amazon SES o Resend 
          quando superi i 500 invii giornalieri o vuoi migliore deliverability.
        </WarningBox>
      </CardContent>
    </Card>
  );
}

export default function GuideEmail() {
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
              <div className="bg-gradient-to-br from-sky-500 to-blue-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-blue-600 bg-clip-text text-transparent">
                  Guida Email Marketing
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configura il sistema di email automatiche in 3 semplici fasi
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Prerequisiti"
              subtitle="Configurazione SMTP obbligatoria - senza questo NON puoi inviare email"
              icon={ShieldCheck}
              gradient="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-950/30 dark:to-orange-950/30"
              borderColor="border-red-200 dark:border-red-800"
            >
              <WarningBox>
                <strong>IMPORTANTE:</strong> Devi configurare un server SMTP prima di poter inviare email. 
                Senza credenziali valide, il sistema non può recapitare i messaggi.
              </WarningBox>

              <StepCard
                number={1}
                title="Scegli il tuo Provider Email"
                description="Seleziona un servizio SMTP compatibile. Gmail è il più semplice per iniziare."
                icon={Server}
                iconColor="bg-red-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Gmail: smtp.gmail.com, porta 587 (TLS)</ChecklistItem>
                  <ChecklistItem>Outlook: smtp-mail.outlook.com, porta 587</ChecklistItem>
                  <ChecklistItem>Amazon SES: email-smtp.eu-west-1.amazonaws.com</ChecklistItem>
                  <ChecklistItem>Resend: smtp.resend.com, porta 465 (SSL)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Ottieni le Credenziali SMTP"
                description="Per Gmail devi creare una 'Password per le app' dalla console Google."
                icon={Key}
                iconColor="bg-orange-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vai su myaccount.google.com → Sicurezza</ChecklistItem>
                  <ChecklistItem>Abilita la verifica in 2 passaggi (se non attiva)</ChecklistItem>
                  <ChecklistItem>Cerca "Password per le app" e genera una nuova</ChecklistItem>
                  <ChecklistItem>Copia la password di 16 caratteri generata</ChecklistItem>
                </ul>
                <WarningBox>
                  <strong>Non usare la password del tuo account!</strong> Devi usare la "Password per le app" 
                  generata appositamente, altrimenti Gmail bloccherà l'accesso.
                </WarningBox>
              </StepCard>

              <StepCard
                number={3}
                title="Configura SMTP nell'App"
                description="Inserisci le credenziali nella pagina di configurazione SMTP."
                icon={Settings}
                iconColor="bg-amber-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
                link="/consultant/smtp-settings"
                linkText="Vai a Configurazione SMTP"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Host SMTP: es. smtp.gmail.com</ChecklistItem>
                  <ChecklistItem>Porta: 587 (TLS) o 465 (SSL)</ChecklistItem>
                  <ChecklistItem>Email mittente: la tua email completa</ChecklistItem>
                  <ChecklistItem>Password: la password per le app generata</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={4}
                title="Testa la Connessione"
                description="Invia un'email di prova per verificare che tutto funzioni correttamente."
                icon={Send}
                iconColor="bg-green-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Clicca "Invia Email di Test" nella pagina SMTP</ChecklistItem>
                  <ChecklistItem>Controlla la tua inbox (anche spam!)</ChecklistItem>
                  <ChecklistItem>Se ricevi l'email, la configurazione è corretta</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SMTPProviderExplainer />

            <SectionCard
              sectionNumber={2}
              title="Configurazione"
              subtitle="Imposta journey templates e task automatici per le email"
              icon={Settings}
              gradient="bg-gradient-to-br from-blue-50 to-violet-50 dark:from-blue-950/30 dark:to-violet-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={5}
                title="Configura i Journey Templates"
                description="I journey sono sequenze di email automatiche inviate in momenti specifici del percorso cliente."
                icon={FileText}
                iconColor="bg-blue-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
                link="/consultant/email-journey"
                linkText="Vai ai Journey Templates"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Ogni journey ha più email programmate nel tempo</ChecklistItem>
                  <ChecklistItem>Usa variabili dinamiche: {"{{nome}}"}, {"{{obiettivo}}"}, {"{{stato}}"}</ChecklistItem>
                  <ChecklistItem>Imposta trigger: dopo iscrizione, dopo X giorni, ecc.</ChecklistItem>
                  <ChecklistItem>Preview sempre prima di attivare</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={6}
                title="Crea Task Automatici Email"
                description="I task programmano invii ricorrenti come reminder settimanali o check-in mensili."
                icon={Calendar}
                iconColor="bg-purple-500"
                badge="CONSIGLIATO"
                badgeVariant="secondary"
                link="/consultant/tasks"
                linkText="Vai ai Task Automatici"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Imposta frequenza: giornaliero, settimanale, mensile</ChecklistItem>
                  <ChecklistItem>Scegli orario di invio (es: ogni lunedì alle 9:00)</ChecklistItem>
                  <ChecklistItem>Seleziona destinatari: tutti i clienti o filtrati per stato</ChecklistItem>
                  <ChecklistItem>Monitora gli invii nello storico</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={7}
                title="Personalizza con l'AI"
                description="Usa Gemini AI per generare email personalizzate basate sul contesto di ogni cliente."
                icon={Sparkles}
                iconColor="bg-fuchsia-500"
                badge="AVANZATO"
                badgeVariant="outline"
                link="/consultant/ai-config"
                linkText="Vai a Configurazione AI"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Configura la tua API key Gemini</ChecklistItem>
                  <ChecklistItem>L'AI adatta il tono in base al cliente</ChecklistItem>
                  <ChecklistItem>Genera contenuti basati su obiettivi e progressi</ChecklistItem>
                  <ChecklistItem>Personalizza automaticamente ogni messaggio</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              title="Monitoraggio"
              subtitle="Controlla lo storico invii e analizza le performance"
              icon={BarChart}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={8}
                title="Visualizza Storico Invii"
                description="Consulta il log completo di tutte le email inviate dal sistema."
                icon={Inbox}
                iconColor="bg-green-500"
                badge="IMPORTANTE"
                badgeVariant="secondary"
                link="/consultant/email-logs"
                linkText="Vai allo Storico Invii"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vedi tutte le email inviate con data e ora</ChecklistItem>
                  <ChecklistItem>Filtra per cliente, stato o periodo</ChecklistItem>
                  <ChecklistItem>Verifica quali email sono state consegnate</ChecklistItem>
                  <ChecklistItem>Identifica errori di invio e risolvili</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={9}
                title="Analizza gli Errori"
                description="Se vedi errori frequenti, ecco come risolverli."
                icon={AlertTriangle}
                iconColor="bg-amber-500"
                badge="TROUBLESHOOTING"
                badgeVariant="outline"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Errore autenticazione: verifica credenziali SMTP</ChecklistItem>
                  <ChecklistItem>Quota superata: passa a un provider con più capacità</ChecklistItem>
                  <ChecklistItem>Email in spam: migliora oggetto e contenuto</ChecklistItem>
                  <ChecklistItem>Timeout: controlla connessione e porta SMTP</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={10}
                title="Ottimizza le Performance"
                description="Best practices per massimizzare l'efficacia delle tue email."
                icon={Zap}
                iconColor="bg-emerald-500"
                badge="BEST PRACTICE"
                badgeVariant="outline"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Oggetto accattivante: max 50 caratteri, niente spam words</ChecklistItem>
                  <ChecklistItem>Personalizza sempre: usa il nome del cliente</ChecklistItem>
                  <ChecklistItem>Max 2-3 email a settimana per cliente</ChecklistItem>
                  <ChecklistItem>Una sola call-to-action chiara per email</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <Card className="bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/30 dark:to-blue-950/30 border-sky-200 dark:border-sky-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ExternalLink className="h-5 w-5" />
                  Link Rapidi Email Marketing
                </CardTitle>
                <CardDescription>Accedi velocemente alle pagine principali del sistema email</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  <Link href="/consultant/smtp-settings">
                    <Button variant="outline" className="gap-2">
                      <Settings className="h-4 w-4" />
                      Configurazione SMTP
                    </Button>
                  </Link>
                  <Link href="/consultant/email-journey">
                    <Button variant="outline" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Journey Templates
                    </Button>
                  </Link>
                  <Link href="/consultant/tasks">
                    <Button variant="outline" className="gap-2">
                      <Calendar className="h-4 w-4" />
                      Task Automatici
                    </Button>
                  </Link>
                  <Link href="/consultant/email-logs">
                    <Button variant="outline" className="gap-2">
                      <Inbox className="h-4 w-4" />
                      Storico Invii
                    </Button>
                  </Link>
                  <Link href="/consultant/ai-config">
                    <Button variant="outline" className="gap-2">
                      <Sparkles className="h-4 w-4" />
                      Configurazione AI
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20">
              <CardHeader>
                <CardTitle>💡 Best Practices Email Marketing</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Oggetto accattivante:</strong> I primi 50 caratteri dell'oggetto sono i più importanti per il tasso di apertura</span></li>
                  <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Personalizza sempre:</strong> Email personalizzate hanno tassi di apertura 2-3x superiori</span></li>
                  <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Evita spam:</strong> Non inviare più di 2-3 email a settimana per cliente</span></li>
                  <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Call to action chiara:</strong> Ogni email deve avere un'azione specifica (es: Prenota, Rispondi, Compila)</span></li>
                  <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Mobile-first:</strong> Oltre il 60% delle email vengono lette da mobile, testa sempre la visualizzazione</span></li>
                  <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Timing perfetto:</strong> Le email inviate martedì-giovedì alle 9-10 o 14-15 hanno i migliori tassi di apertura</span></li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
