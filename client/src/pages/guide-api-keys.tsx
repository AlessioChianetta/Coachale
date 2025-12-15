import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Key, 
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Brain,
  Mail,
  Calendar,
  Video,
  Settings,
  Shield,
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

export default function GuideApiKeys() {
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
                  Guida Configurazione API Keys
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configura tutte le API: Vertex AI, SMTP, Google Calendar, TURN/Metered
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              totalSections={5}
              title="Vertex AI / Gemini"
              subtitle="Configurare l'intelligenza artificiale"
              icon={Brain}
              gradient="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30"
              borderColor="border-purple-200 dark:border-purple-800"
            >
              <StepCard
                number={1}
                title="Vai su API Keys"
                description="Accedi alla pagina di configurazione API Keys."
                icon={Key}
                iconColor="bg-purple-500"
                link="/consultant/api-keys-unified"
                linkText="Configura API"
              />

              <StepCard
                number={2}
                title="Scegli provider AI"
                description="Hai due opzioni per configurare l'intelligenza artificiale."
                icon={Brain}
                iconColor="bg-violet-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Vertex AI (Google Cloud) - Piu potente
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    Google AI Studio - Piu semplice
                  </Badge>
                </div>
              </StepCard>

              <StepCard
                number={3}
                title="Configurare Vertex AI"
                description="Se scegli Vertex AI (consigliato per produzione)."
                icon={Settings}
                iconColor="bg-indigo-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Crea progetto su Google Cloud Console</ChecklistItem>
                  <ChecklistItem>Abilita Vertex AI API</ChecklistItem>
                  <ChecklistItem>Crea Service Account con ruolo 'Vertex AI User'</ChecklistItem>
                  <ChecklistItem>Scarica JSON delle credenziali</ChecklistItem>
                  <ChecklistItem>Copia il contenuto nel campo 'Credenziali JSON'</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={4}
                title="Configurare Google AI Studio"
                description="Alternativa piu semplice per iniziare rapidamente."
                icon={Zap}
                iconColor="bg-blue-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Vai su aistudio.google.com</ChecklistItem>
                  <ChecklistItem>Crea API Key</ChecklistItem>
                  <ChecklistItem>Copia la chiave nel campo 'API Key'</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Test connessione"
                description="Clicca 'Test Connessione' per verificare che le credenziali funzionino."
                icon={CheckCircle2}
                iconColor="bg-green-500"
              />
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              totalSections={5}
              title="SMTP per Email"
              subtitle="Configurare l'invio email automatiche"
              icon={Mail}
              gradient="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={1}
                title="Configurazione Gmail (consigliata)"
                description="Gmail e il provider piu semplice da configurare."
                icon={Mail}
                iconColor="bg-blue-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ul className="space-y-1 text-sm font-mono">
                    <li>Host: <span className="text-blue-600">smtp.gmail.com</span></li>
                    <li>Porta: <span className="text-blue-600">587</span></li>
                    <li>Email: <span className="text-blue-600">tua-email@gmail.com</span></li>
                    <li>Password: <span className="text-blue-600">App Password (16 caratteri)</span></li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Generare App Password Gmail"
                description="Devi abilitare la verifica in 2 passaggi e generare una password dedicata."
                icon={Key}
                iconColor="bg-cyan-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Vai su myaccount.google.com</ChecklistItem>
                  <ChecklistItem>Sicurezza → Verifica in 2 passaggi (attivala)</ChecklistItem>
                  <ChecklistItem>Sicurezza → Password per le app</ChecklistItem>
                  <ChecklistItem>Crea nuova password per 'Posta'</ChecklistItem>
                  <ChecklistItem>Copia la password generata (16 caratteri senza spazi)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Altri provider SMTP"
                description="Se non usi Gmail, ecco le configurazioni per altri provider."
                icon={Settings}
                iconColor="bg-teal-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ul className="space-y-1 text-sm">
                    <li><strong>Outlook:</strong> smtp-mail.outlook.com (587)</li>
                    <li><strong>Yahoo:</strong> smtp.mail.yahoo.com (587)</li>
                    <li><strong>SendGrid:</strong> smtp.sendgrid.net (587)</li>
                    <li><strong>Mailgun:</strong> smtp.mailgun.org (587)</li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Test invio email"
                description="Clicca 'Invia Email di Test' per verificare la configurazione."
                icon={CheckCircle2}
                iconColor="bg-green-500"
              />
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              totalSections={5}
              title="Google Calendar"
              subtitle="Collegare il calendario per appuntamenti automatici"
              icon={Calendar}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={1}
                title="Creare credenziali OAuth"
                description="Vai su Google Cloud Console e crea le credenziali OAuth."
                icon={Key}
                iconColor="bg-green-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>APIs & Services → Credentials</ChecklistItem>
                  <ChecklistItem>Create Credentials → OAuth 2.0 Client ID</ChecklistItem>
                  <ChecklistItem>Application type: Web application</ChecklistItem>
                  <ChecklistItem>Authorized redirect URIs: aggiungi l'URL del tuo sistema</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Inserire credenziali"
                description="Copia le credenziali dalla console Google Cloud."
                icon={Settings}
                iconColor="bg-emerald-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Client ID: termina con .apps.googleusercontent.com</ChecklistItem>
                  <ChecklistItem>Client Secret: stringa generata</ChecklistItem>
                  <ChecklistItem>Redirect URI: URL di callback del sistema</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Autorizzare l'accesso"
                description="Clicca 'Connetti Google Calendar'. Si aprira una finestra Google per autorizzare l'accesso."
                icon={Shield}
                iconColor="bg-teal-500"
              />

              <StepCard
                number={4}
                title="Selezionare calendario"
                description="Dopo l'autorizzazione, seleziona quale calendario usare per gli appuntamenti."
                icon={Calendar}
                iconColor="bg-cyan-500"
              />
            </SectionCard>

            <SectionCard
              sectionNumber={4}
              totalSections={5}
              title="TURN/Metered per Video Meeting"
              subtitle="Configurare server TURN per video chiamate stabili"
              icon={Video}
              gradient="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
              borderColor="border-orange-200 dark:border-orange-800"
            >
              <StepCard
                number={1}
                title="Cos'e un server TURN"
                description="I server TURN aiutano a stabilire connessioni video quando i partecipanti sono dietro firewall o NAT restrittivi."
                icon={Video}
                iconColor="bg-orange-500"
              />

              <StepCard
                number={2}
                title="Provider consigliato: Metered"
                description="Metered.ca offre server TURN affidabili."
                icon={Settings}
                iconColor="bg-amber-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Registrati su metered.ca</ChecklistItem>
                  <ChecklistItem>Crea un'applicazione</ChecklistItem>
                  <ChecklistItem>Copia le credenziali TURN</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Inserire credenziali TURN"
                description="Configura le credenziali del server TURN."
                icon={Key}
                iconColor="bg-yellow-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <ul className="space-y-1 text-sm font-mono">
                    <li>TURN URL: <span className="text-orange-600">turn:xxx.metered.ca:443</span></li>
                    <li>Username: <span className="text-orange-600">fornito da Metered</span></li>
                    <li>Credential: <span className="text-orange-600">password fornita</span></li>
                  </ul>
                </div>
              </StepCard>

              <WarningBox>
                Il server TURN e opzionale ma consigliato se i tuoi clienti usano reti aziendali restrittive o hai problemi di connessione nelle video chiamate.
              </WarningBox>
            </SectionCard>

            <SectionCard
              sectionNumber={5}
              totalSections={5}
              title="Verifica Stato Connessioni"
              subtitle="Come verificare che tutto funzioni"
              icon={CheckCircle2}
              gradient="bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/30 dark:to-green-950/30"
              borderColor="border-emerald-200 dark:border-emerald-800"
            >
              <StepCard
                number={1}
                title="Badge stato AI"
                description="In alto nella pagina vedi un badge che indica lo stato dell'AI."
                icon={Brain}
                iconColor="bg-emerald-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    Verde - Vertex AI attivo
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    Giallo - Google AI Studio fallback
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    Rosso - Nessun AI configurato
                  </Badge>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Stato per sezione"
                description="Ogni tab mostra lo stato della configurazione."
                icon={CheckCircle2}
                iconColor="bg-green-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Configurato e funzionante
                  </Badge>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Configurato con problemi
                  </Badge>
                  <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                    Non configurato
                  </Badge>
                </div>
              </StepCard>

              <StepCard
                number={3}
                title="Troubleshooting"
                description="Se un test fallisce, controlla questi punti."
                icon={AlertTriangle}
                iconColor="bg-amber-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Verifica che le credenziali siano corrette (no spazi extra)</ChecklistItem>
                  <ChecklistItem>Controlla che l'API/servizio sia abilitato</ChecklistItem>
                  <ChecklistItem>Verifica i permessi dell'account</ChecklistItem>
                  <ChecklistItem>Controlla eventuali limiti di quota</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-amber-600" />
                  Accesso Rapido
                </CardTitle>
                <CardDescription>
                  Vai direttamente alla configurazione API
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Link href="/consultant/api-keys-unified">
                  <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                    <Key className="h-5 w-5 text-amber-600" />
                    <div className="text-left">
                      <div className="font-medium">API Keys</div>
                      <div className="text-xs text-muted-foreground">Configura tutte le API in un'unica pagina</div>
                    </div>
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
