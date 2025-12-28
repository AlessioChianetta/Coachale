import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Instagram,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  ExternalLink,
  Key,
  Settings,
  Webhook,
  Clock,
  Zap,
  MessageCircle,
  AtSign,
  Timer,
  Link2,
  Bot,
  Image
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

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-cyan-50 dark:bg-cyan-950/40 rounded-lg border border-cyan-200 dark:border-cyan-800">
      <Instagram className="h-5 w-5 text-cyan-600 shrink-0 mt-0.5" />
      <div className="text-sm text-cyan-800 dark:text-cyan-200">{children}</div>
    </div>
  );
}

export default function GuideInstagram() {
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
              <div className="bg-gradient-to-br from-cyan-500 to-teal-600 p-4 rounded-2xl shadow-lg">
                <Instagram className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-600 to-teal-600 bg-clip-text text-transparent">
                  Guida Instagram DM Integration
                </h1>
                <p className="text-muted-foreground mt-1">
                  Configura l'integrazione Instagram DM in 3 semplici fasi
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              title="Prerequisiti e Setup Account"
              subtitle="Configurazione iniziale obbligatoria - senza questi passaggi l'integrazione NON funziona"
              icon={ShieldCheck}
              gradient="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30"
              borderColor="border-cyan-200 dark:border-cyan-800"
            >
              <WarningBox>
                <strong>IMPORTANTE:</strong> Per ricevere e inviare messaggi Instagram DM, devi avere un Account Instagram Business 
                collegato a una Facebook Page. Gli account personali NON supportano le API Messaging.
              </WarningBox>

              <StepCard
                number={1}
                title="Requisiti Account"
                description="Assicurati di avere i requisiti base per l'integrazione Instagram DM."
                icon={Instagram}
                iconColor="bg-cyan-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Account Instagram convertito in Business o Creator</ChecklistItem>
                  <ChecklistItem>Facebook Page collegata all'account Instagram</ChecklistItem>
                  <ChecklistItem>Essere admin della Facebook Page</ChecklistItem>
                  <ChecklistItem>App registrata su Meta for Developers</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Ottieni Page ID"
                description="Trova il Page ID della tua Facebook Page collegata a Instagram."
                icon={Key}
                iconColor="bg-teal-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vai su Facebook Business Suite (business.facebook.com)</ChecklistItem>
                  <ChecklistItem>Seleziona la tua Page dal menu a sinistra</ChecklistItem>
                  <ChecklistItem>Vai su Impostazioni → Informazioni sulla Pagina</ChecklistItem>
                  <ChecklistItem>Copia il "Page ID" (numero lungo)</ChecklistItem>
                </ul>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-sm font-mono">
                    Esempio Page ID: <span className="text-cyan-600">123456789012345</span>
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={3}
                title="Genera Access Token"
                description="Crea un Access Token con i permessi necessari per Instagram Messaging."
                icon={ExternalLink}
                iconColor="bg-cyan-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vai su developers.facebook.com → La tua App</ChecklistItem>
                  <ChecklistItem>Tools → Graph API Explorer</ChecklistItem>
                  <ChecklistItem>Seleziona la tua App e la Page</ChecklistItem>
                  <ChecklistItem>Aggiungi permessi: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">instagram_manage_messages</code>, <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">pages_messaging</code></ChecklistItem>
                  <ChecklistItem>Genera Access Token e copia</ChecklistItem>
                </ul>
                <WarningBox>
                  <strong>Token Scadenza:</strong> I token temporanei scadono dopo 1 ora. Per la produzione, 
                  genera un Long-Lived Token (60 giorni) o un System User Token (permanente).
                </WarningBox>
              </StepCard>

              <StepCard
                number={4}
                title="Trova App Secret"
                description="L'App Secret serve per verificare le richieste webhook."
                icon={Key}
                iconColor="bg-teal-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vai su developers.facebook.com → La tua App</ChecklistItem>
                  <ChecklistItem>Settings → Basic</ChecklistItem>
                  <ChecklistItem>Clicca "Show" accanto a "App Secret"</ChecklistItem>
                  <ChecklistItem>Copia l'App Secret (stringa alfanumerica)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Configura in Coachale"
                description="Inserisci tutte le credenziali nel pannello API Keys di Coachale."
                icon={Settings}
                iconColor="bg-cyan-500"
                link="/consultant/api-keys"
                linkText="Vai alle API Keys"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Apri API Keys → Tab "Instagram"</ChecklistItem>
                  <ChecklistItem>Inserisci Page ID</ChecklistItem>
                  <ChecklistItem>Inserisci Access Token</ChecklistItem>
                  <ChecklistItem>Inserisci App Secret</ChecklistItem>
                  <ChecklistItem>Seleziona l'Agente WhatsApp da collegare</ChecklistItem>
                  <ChecklistItem>Salva la configurazione</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              title="Configurazione Webhook"
              subtitle="Configura il webhook per ricevere i messaggi Instagram in tempo reale"
              icon={Webhook}
              gradient="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30"
              borderColor="border-teal-200 dark:border-teal-800"
            >
              <InfoBox>
                Il webhook permette a Instagram di inviare notifiche in tempo reale quando ricevi un messaggio DM, 
                una menzione nelle storie, o un commento.
              </InfoBox>

              <StepCard
                number={1}
                title="Accedi a Meta for Developers"
                description="Apri la console sviluppatori Meta per configurare il webhook."
                icon={ExternalLink}
                iconColor="bg-teal-500"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Vai su developers.facebook.com</ChecklistItem>
                  <ChecklistItem>Seleziona la tua App dal menu "My Apps"</ChecklistItem>
                  <ChecklistItem>Nel menu a sinistra, trova "Instagram" → "Webhooks"</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Configura Callback URL"
                description="Inserisci l'URL del tuo server Coachale per ricevere gli eventi."
                icon={Link2}
                iconColor="bg-cyan-500"
                badge="IMPORTANTE"
              >
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-3">
                  <p className="text-sm">
                    <strong>Callback URL:</strong><br />
                    <code className="text-cyan-600 font-mono">https://tuodominio.com/api/instagram/webhook</code>
                  </p>
                </div>
                <ul className="space-y-1.5">
                  <ChecklistItem>Sostituisci "tuodominio.com" con il tuo dominio Coachale</ChecklistItem>
                  <ChecklistItem>Assicurati che sia HTTPS (SSL obbligatorio)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Imposta Verify Token"
                description="Il token di verifica serve per validare la connessione webhook."
                icon={Key}
                iconColor="bg-teal-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Scegli un token segreto (stringa alfanumerica a tua scelta)</ChecklistItem>
                  <ChecklistItem>Inseriscilo in Meta for Developers nel campo "Verify Token"</ChecklistItem>
                  <ChecklistItem>Inserisci lo STESSO token nelle API Keys di Coachale</ChecklistItem>
                </ul>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-sm font-mono">
                    Esempio Verify Token: <span className="text-teal-600">mio_token_segreto_12345</span>
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Sottoscrivi agli Eventi"
                description="Seleziona quali eventi Instagram vuoi ricevere tramite webhook."
                icon={Webhook}
                iconColor="bg-cyan-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem><strong>messages</strong> - Messaggi DM in arrivo</ChecklistItem>
                  <ChecklistItem><strong>messaging_postbacks</strong> - Risposte ai pulsanti interattivi</ChecklistItem>
                </ul>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-3">
                  <p className="text-sm font-medium mb-2">Sottoscrizioni opzionali:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• <strong>messaging_seen</strong> - Notifica lettura messaggi</li>
                    <li>• <strong>messaging_referrals</strong> - Link referral</li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Verifica Webhook"
                description="Testa che il webhook funzioni correttamente."
                icon={CheckCircle2}
                iconColor="bg-teal-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Clicca "Verify and Save" in Meta for Developers</ChecklistItem>
                  <ChecklistItem>Se verde, il webhook e configurato correttamente</ChecklistItem>
                  <ChecklistItem>Invia un messaggio di test al tuo account Instagram</ChecklistItem>
                  <ChecklistItem>Verifica che arrivi nella sezione Instagram di Coachale</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              title="Funzionalita e Limiti"
              subtitle="Cosa puoi fare con l'integrazione Instagram DM e quali sono le limitazioni"
              icon={Zap}
              gradient="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30"
              borderColor="border-cyan-200 dark:border-cyan-800"
            >
              <StepCard
                number={1}
                title="Finestra 24 Ore"
                description="Instagram permette di rispondere ai messaggi solo entro 24 ore dall'ultimo messaggio ricevuto dall'utente."
                icon={Timer}
                iconColor="bg-amber-500"
                badge="LIMITE CRITICO"
                badgeVariant="destructive"
              >
                <WarningBox>
                  <strong>ATTENZIONE:</strong> Se l'utente non risponde entro 24 ore, NON potrai piu inviargli messaggi 
                  finche non ti scrive di nuovo. Questa e una policy di Instagram per prevenire spam.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-3">
                  <p className="text-sm font-medium mb-2">Come funziona:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• L'utente ti scrive → Finestra aperta per 24h</li>
                    <li>• Puoi rispondere quante volte vuoi in queste 24h</li>
                    <li>• L'utente risponde → Finestra si resetta (altre 24h)</li>
                    <li>• Nessuna risposta dopo 24h → Finestra chiusa</li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Rate Limit"
                description="Instagram limita il numero di messaggi che puoi inviare ogni ora."
                icon={Clock}
                iconColor="bg-orange-500"
                badge="200 DM/ora"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Massimo 200 messaggi DM all'ora</ChecklistItem>
                  <ChecklistItem>Il conteggio si resetta ogni ora</ChecklistItem>
                  <ChecklistItem>Superando il limite, i messaggi vengono messi in coda</ChecklistItem>
                  <ChecklistItem>I messaggi in coda vengono inviati automaticamente quando disponibile</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Collegamento con WhatsApp Agent"
                description="L'agente Instagram usa le stesse impostazioni AI dell'agente WhatsApp collegato."
                icon={Bot}
                iconColor="bg-cyan-500"
                link="/consultant/whatsapp"
                linkText="Gestisci Agenti WhatsApp"
              >
                <InfoBox>
                  Quando colleghi un Agente WhatsApp all'integrazione Instagram, l'AI usera le stesse istruzioni, 
                  personalita e knowledge base configurate per quell'agente.
                </InfoBox>
                <ul className="space-y-1.5 mt-3">
                  <ChecklistItem>Seleziona l'agente nelle API Keys → Instagram</ChecklistItem>
                  <ChecklistItem>L'agente risponde con lo stesso stile su entrambi i canali</ChecklistItem>
                  <ChecklistItem>Knowledge base condivisa tra WhatsApp e Instagram</ChecklistItem>
                  <ChecklistItem>Puoi cambiare agente in qualsiasi momento</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={4}
                title="Story Replies e Mentions"
                description="L'agente puo rispondere automaticamente quando qualcuno ti menziona nelle storie."
                icon={AtSign}
                iconColor="bg-teal-500"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Risposte automatiche alle menzioni nelle storie</ChecklistItem>
                  <ChecklistItem>L'utente menziona il tuo account → Ricevi notifica</ChecklistItem>
                  <ChecklistItem>L'agente puo inviare un DM di ringraziamento/engagement</ChecklistItem>
                  <ChecklistItem>Perfetto per aumentare l'engagement con i follower</ChecklistItem>
                </ul>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2">Esempio risposta:</p>
                  <p className="text-sm text-muted-foreground italic">
                    "Ciao! Ho visto che mi hai menzionato nella tua storia. Grazie mille! 
                    C'e qualcosa in cui posso aiutarti?"
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Comment-to-DM"
                description="Invia DM automatici quando qualcuno commenta un tuo post con una parola chiave."
                icon={MessageCircle}
                iconColor="bg-cyan-600"
              >
                <ul className="space-y-1.5 mb-3">
                  <ChecklistItem>Configura parole chiave trigger (es: "info", "prezzo")</ChecklistItem>
                  <ChecklistItem>L'utente commenta con la keyword → Riceve DM automatico</ChecklistItem>
                  <ChecklistItem>Perfetto per lead generation da post organici</ChecklistItem>
                  <ChecklistItem>Rispetta sempre la finestra 24h (l'utente deve rispondere)</ChecklistItem>
                </ul>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2">Esempio flusso:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>1. Pubblichi un post: "Commenta INFO per ricevere dettagli"</li>
                    <li>2. L'utente commenta: "INFO"</li>
                    <li>3. L'agente invia DM automatico con le informazioni</li>
                    <li>4. L'utente risponde → Conversazione avviata</li>
                  </ul>
                </div>
              </StepCard>

              <div className="flex flex-wrap gap-3 pt-4">
                <Link href="/consultant/api-keys">
                  <Button className="gap-2 bg-cyan-600 hover:bg-cyan-700">
                    <Key className="h-4 w-4" />
                    Configura API Keys
                  </Button>
                </Link>
                <Link href="/consultant/whatsapp">
                  <Button variant="outline" className="gap-2">
                    <Bot className="h-4 w-4" />
                    Gestisci Agenti
                  </Button>
                </Link>
                <Link href="/consultant/guide-whatsapp">
                  <Button variant="outline" className="gap-2">
                    <Image className="h-4 w-4" />
                    Guida WhatsApp
                  </Button>
                </Link>
              </div>
            </SectionCard>
          </div>
        </main>
      </div>
      
      <GuideFloatingAssistant />
    </div>
  );
}
