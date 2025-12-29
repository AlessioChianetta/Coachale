import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import businessMenuImage from "@assets/image_1766958254935.png";
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
  Image,
  ArrowRight,
  BookOpen,
  Sparkles,
  AlertCircle,
  RefreshCw,
  MessageSquareX,
  UserX,
  ShieldX,
  Smartphone,
  Star
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
          <ProgressIndicator current={sectionNumber} total={4} />
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

function ExternalLinkButton({ 
  href, 
  children, 
  variant = "default" 
}: { 
  href: string; 
  children: React.ReactNode; 
  variant?: "default" | "outline" 
}) {
  return (
    <a 
      href={href} 
      target="_blank" 
      rel="noopener noreferrer"
      className="inline-block"
    >
      <Button 
        variant={variant} 
        size="sm" 
        className={`gap-2 ${variant === "default" ? "bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 text-white" : "border-cyan-300 hover:bg-cyan-50 dark:border-cyan-700 dark:hover:bg-cyan-950"}`}
      >
        {children}
        <ExternalLink className="h-3.5 w-3.5" />
      </Button>
    </a>
  );
}

function ComparisonBox() {
  return (
    <div className="bg-gradient-to-br from-purple-50 to-cyan-50 dark:from-purple-950/30 dark:to-cyan-950/30 rounded-xl border border-purple-200 dark:border-purple-800 p-5">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-purple-900 dark:text-purple-100">Coachale vs ManyChat - Cosa ci distingue</h4>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white/60 dark:bg-gray-900/60 rounded-lg p-4 border">
          <p className="text-sm font-medium text-gray-500 mb-2">ManyChat</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Flussi basati su regole (if/then)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Risposte pre-scritte manuali</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Nessuna personalita dinamica</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400">•</span>
              <span>Solo automazione messaggi</span>
            </li>
          </ul>
        </div>
        <div className="bg-gradient-to-br from-cyan-100/80 to-teal-100/80 dark:from-cyan-900/40 dark:to-teal-900/40 rounded-lg p-4 border border-cyan-300 dark:border-cyan-700">
          <p className="text-sm font-medium text-cyan-700 dark:text-cyan-300 mb-2">Coachale (AI-Powered)</p>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span>AI Gemini con comprensione naturale</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span>Risponde usando la tua Knowledge Base</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span>Personalita configurabile per agente</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              <span>Integrato con Lead Hub e Calendario</span>
            </li>
          </ul>
        </div>
      </div>
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

            <ComparisonBox />

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

              <div className="bg-gradient-to-r from-cyan-100 to-teal-100 dark:from-cyan-900/40 dark:to-teal-900/40 rounded-xl p-5 border border-cyan-300 dark:border-cyan-700">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Link2 className="h-5 w-5 text-cyan-600" />
                  Catena di Collegamenti Obbligatoria
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Per usare le API Instagram, devi avere questa struttura di account collegati. Senza tutti e 3, l'integrazione NON funziona:
                </p>
                <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4 justify-center py-4">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center shadow-sm border min-w-[140px]">
                    <Instagram className="h-6 w-6 mx-auto mb-1 text-pink-500" />
                    <p className="text-xs font-medium">Instagram</p>
                    <p className="text-[10px] text-muted-foreground">Business/Creator</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-cyan-500 rotate-90 sm:rotate-0" />
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center shadow-sm border min-w-[140px]">
                    <div className="h-6 w-6 mx-auto mb-1 bg-blue-500 rounded text-white text-xs flex items-center justify-center font-bold">f</div>
                    <p className="text-xs font-medium">Facebook Page</p>
                    <p className="text-[10px] text-muted-foreground">Nuova Esperienza Pagine</p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-cyan-500 rotate-90 sm:rotate-0" />
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-center shadow-sm border min-w-[140px]">
                    <div className="h-6 w-6 mx-auto mb-1 bg-blue-600 rounded text-white text-xs flex items-center justify-center font-bold">B</div>
                    <p className="text-xs font-medium">Business Manager</p>
                    <p className="text-[10px] text-muted-foreground">business.facebook.com</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  <ExternalLinkButton href="https://business.facebook.com/">
                    Apri Business Manager
                  </ExternalLinkButton>
                  <ExternalLinkButton href="https://www.facebook.com/business/help/1710077379203657" variant="outline">
                    Guida collegamento completa
                  </ExternalLinkButton>
                </div>

                <div className="mt-4 pt-4 border-t border-cyan-200 dark:border-cyan-700">
                  <p className="text-sm text-muted-foreground mb-3 text-center">
                    Nel menu laterale di Business Manager, troverai <strong>"Account Instagram"</strong> sotto la sezione Account:
                  </p>
                  <div className="flex justify-center">
                    <img 
                      src={businessMenuImage} 
                      alt="Menu Business Manager - Account Instagram" 
                      className="rounded-lg border shadow-md max-w-[200px]"
                    />
                  </div>
                </div>
              </div>

              <StepCard
                number={1}
                title="Requisiti Account"
                description="Prima di iniziare, assicurati di avere tutti i requisiti base. Senza questi, l'integrazione non funzionera."
                icon={Instagram}
                iconColor="bg-cyan-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <ul className="space-y-2 mb-4">
                  <ChecklistItem>
                    <strong>Account Instagram Business/Creator</strong> - Vai su Instagram → Impostazioni → Account → Passa a un account professionale
                  </ChecklistItem>
                  <ChecklistItem>
                    <strong>Facebook Page collegata</strong> - L'account Instagram deve essere collegato a una Facebook Page di cui sei admin
                  </ChecklistItem>
                  <ChecklistItem>
                    <strong>Ruolo Admin</strong> - Devi essere admin o editor della Facebook Page (non solo contributor)
                  </ChecklistItem>
                  <ChecklistItem>
                    <strong>App Meta for Developers</strong> - Devi creare un'app nella console sviluppatori Meta
                  </ChecklistItem>
                </ul>
                <div className="flex flex-wrap gap-2">
                  <ExternalLinkButton href="https://help.instagram.com/502981923235522">
                    Come convertire a Business
                  </ExternalLinkButton>
                  <ExternalLinkButton href="https://www.facebook.com/help/1148909221857370" variant="outline">
                    Collegare Instagram a Facebook
                  </ExternalLinkButton>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Crea App su Meta for Developers"
                description="Devi creare un'app Meta per ottenere le credenziali API. Questa app gestira la comunicazione tra Instagram e Coachale."
                icon={Settings}
                iconColor="bg-teal-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Procedura passo-passo:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Clicca il link sotto per aprire Meta for Developers</li>
                    <li>Accedi con il tuo account Facebook (quello admin della Page)</li>
                    <li>Clicca <strong>"My Apps"</strong> in alto a destra</li>
                    <li>Clicca <strong>"Create App"</strong></li>
                    <li>Seleziona <strong>"Business"</strong> come tipo di app</li>
                    <li>Dai un nome (es: "Coachale Instagram Bot")</li>
                    <li>Aggiungi il prodotto <strong>"Messenger"</strong> alla tua app</li>
                  </ol>
                </div>
                <ExternalLinkButton href="https://developers.facebook.com/apps/">
                  Apri Meta for Developers
                </ExternalLinkButton>
              </StepCard>

              <StepCard
                number={3}
                title="Ottieni Page ID"
                description="Il Page ID identifica la tua Facebook Page collegata all'account Instagram. E un numero lungo di circa 15 cifre."
                icon={Key}
                iconColor="bg-cyan-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Metodo Veloce - Dall'URL:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Apri <strong>Facebook Business Suite</strong> (link sotto)</li>
                    <li>Guarda l'URL nella barra degli indirizzi</li>
                    <li>Cerca il parametro <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">asset_id=</code></li>
                    <li>Il numero dopo <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">asset_id=</code> è il tuo Page ID</li>
                  </ol>
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mt-3">
                    <p className="text-xs font-mono break-all">
                      https://business.facebook.com/latest/home?<span className="text-cyan-600 font-bold">asset_id=655018317702995</span>&business_id=...
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      In questo esempio, il Page ID è <span className="text-cyan-600 font-bold">655018317702995</span>
                    </p>
                  </div>
                </div>
                <WarningBox>
                  <strong>Attenzione:</strong> NON usare il <code className="bg-amber-200 dark:bg-amber-800 px-1 rounded text-xs">business_id</code> dall'URL! 
                  Quello è l'ID del Business Manager, non della Page. Usa solo il valore di <code className="bg-amber-200 dark:bg-amber-800 px-1 rounded text-xs">asset_id</code>.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4 mb-4">
                  <p className="text-sm font-medium mb-3">Metodo Alternativo - Dalle Impostazioni:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Nel menu a sinistra, seleziona la tua <strong>Page</strong></li>
                    <li>Vai su <strong>Impostazioni</strong> (icona ingranaggio)</li>
                    <li>Cerca <strong>"Informazioni sulla Pagina"</strong> o <strong>"About"</strong></li>
                    <li>Scorri fino a trovare <strong>"Page ID"</strong></li>
                    <li>Copia il numero</li>
                  </ol>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
                  <p className="text-sm font-mono">
                    Esempio Page ID: <span className="text-cyan-600 font-bold">655018317702995</span>
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <ExternalLinkButton href="https://business.facebook.com/">
                    Apri Facebook Business Suite
                  </ExternalLinkButton>
                  <ExternalLinkButton href="https://www.facebook.com/help/1503421039731588" variant="outline">
                    Guida ufficiale Page ID
                  </ExternalLinkButton>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Genera Access Token"
                description="L'Access Token permette a Coachale di inviare messaggi per conto del tuo account."
                icon={ExternalLink}
                iconColor="bg-teal-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-3 border border-red-200 dark:border-red-800 mb-4">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    <strong>ATTENZIONE:</strong> Serve un <strong>Page Access Token</strong>, NON un User Token! 
                    Se usi il Graph API Explorer, devi selezionare la tua <strong>Pagina Facebook</strong> dal menu "User or Page" (non lasciare "User Token"). 
                    La procedura sotto genera automaticamente il token corretto.
                  </p>
                </div>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Procedura Rapida (Dashboard App) - CONSIGLIATA:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Apri la <strong>dashboard della tua App</strong> su Meta for Developers</li>
                    <li>Clicca su <strong>"Personalizza"</strong> (icona matita) nel riquadro <strong>"Gestisci i messaggi e i contenuti su Instagram"</strong></li>
                    <li><strong>Permessi:</strong> Nel riquadro 1, clicca il pulsante blu <strong>"Add all required permissions"</strong> (aggiunge <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">instagram_manage_messages</code> automaticamente). Se vuoi supportare anche i commenti, aggiungi <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">instagram_manage_comments</code>. Se il test fallisce, aggiungi manualmente anche <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">pages_read_engagement</code></li>
                    <li><strong>Genera Token:</strong> Nel riquadro 2 <strong>("Genera i token d'accesso")</strong>:
                      <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                        <li>Clicca <strong>"Aggiungi account"</strong> e seleziona il tuo Instagram Business</li>
                        <li>Una volta aggiunto, clicca su <strong>"Generate token"</strong> accanto al nome dell'account</li>
                      </ul>
                    </li>
                    <li><strong>Copia</strong> il token generato</li>
                  </ol>
                </div>
                <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-3 border border-green-200 dark:border-green-800 mb-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <CheckCircle2 className="h-4 w-4 inline mr-1" />
                    <strong>Vantaggio:</strong> Questo metodo e piu veloce del Graph API Explorer e aggiunge automaticamente tutti i permessi necessari con un solo click!
                  </p>
                </div>

                {/* Sezione PRO - Token Illimitato */}
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/40 dark:to-indigo-950/40 rounded-lg border border-purple-200 dark:border-purple-800 overflow-hidden mb-4">
                  <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2">
                    <p className="text-white font-semibold flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      Metodo PRO: Token Illimitato (System User)
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Usa questa procedura se vuoi un token che <strong>non scade mai</strong>. Richiede accesso al Meta Business Manager.
                    </p>
                    
                    <div className="space-y-4">
                      <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border">
                        <p className="text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">1. Accedi alle Impostazioni Business</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li>Vai su <strong>business.facebook.com/settings</strong></li>
                          <li>Seleziona il tuo account Business Manager aziendale</li>
                        </ul>
                      </div>

                      <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border">
                        <p className="text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">2. Crea un Utente di Sistema</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li>Menu sinistra → <strong>Utenti</strong> → <strong>Utenti di sistema</strong></li>
                          <li>Clicca <strong>Aggiungi</strong></li>
                          <li>Nome: es. <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">Coachale API User</code></li>
                          <li>Ruolo: <strong>Amministratore</strong> (System Administrator)</li>
                          <li>Clicca <strong>Crea utente di sistema</strong></li>
                        </ul>
                      </div>

                      <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border">
                        <p className="text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">3. Assegna l'App all'Utente</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li>Seleziona l'utente appena creato</li>
                          <li>Clicca <strong>Aggiungi risorse</strong> (Add Assets)</li>
                          <li>Seleziona <strong>App</strong> → la tua app (Coachale)</li>
                          <li>Attiva <strong>"Gestisci App"</strong> (Controllo completo)</li>
                          <li>Clicca <strong>Salva modifiche</strong></li>
                        </ul>
                      </div>

                      <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-3 border">
                        <p className="text-sm font-medium mb-2 text-purple-700 dark:text-purple-300">4. Genera il Token "Maestro" (System User)</p>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                          <li>Clicca <strong>Genera nuovo token</strong></li>
                          <li>Seleziona la tua App dal menu</li>
                          <li>Scadenza Token: <strong>Non scade mai</strong> (Never)</li>
                          <li>Permessi da selezionare:</li>
                        </ul>
                        <div className="flex flex-wrap gap-1 mt-2 ml-4">
                          <code className="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-xs text-purple-700 dark:text-purple-300">instagram_manage_messages</code>
                          <code className="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-xs text-purple-700 dark:text-purple-300">instagram_manage_comments</code>
                          <code className="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-xs text-purple-700 dark:text-purple-300">instagram_basic</code>
                          <code className="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-xs text-purple-700 dark:text-purple-300">pages_read_engagement</code>
                          <code className="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-xs text-purple-700 dark:text-purple-300">pages_messaging</code>
                          <code className="bg-purple-100 dark:bg-purple-900 px-1.5 py-0.5 rounded text-xs text-purple-700 dark:text-purple-300">pages_show_list</code>
                        </div>
                        <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1 mt-2">
                          <li>Clicca <strong>Genera token</strong> e copia la stringa</li>
                        </ul>
                        <div className="bg-amber-50 dark:bg-amber-950/40 rounded p-2 mt-2 border border-amber-200 dark:border-amber-800">
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            <strong>Nota:</strong> Questo è il tuo System User Token. Tienilo da parte, serve per il prossimo passaggio.
                          </p>
                        </div>
                      </div>

                      <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-3 border border-red-200 dark:border-red-800">
                        <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-300 flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4" />
                          Errore: "Autorizzazioni non aggiunte alla tua app"?
                        </p>
                        <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                          Se appare questo errore rosso mentre selezioni i permessi:
                        </p>
                        <ol className="text-sm text-red-600 dark:text-red-400 list-decimal list-inside space-y-1">
                          <li>Lascia aperta questa scheda</li>
                          <li>Apri <strong>developers.facebook.com</strong> → la tua App</li>
                          <li>Vai su <strong>Casi d'uso</strong> → <strong>Gestisci i messaggi... Instagram</strong> → <strong>Personalizza</strong></li>
                          <li>Nella sezione Autorizzazioni, clicca <strong>Aggiungi</strong> accanto ai permessi mancanti</li>
                          <li>Torna qui e riprova</li>
                        </ol>
                      </div>

                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/40 dark:to-emerald-950/40 rounded-lg p-3 border border-green-300 dark:border-green-700">
                        <p className="text-sm font-medium mb-2 text-green-700 dark:text-green-300 flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          5. Ottieni il Token Finale (Page Token) - FONDAMENTALE
                        </p>
                        <p className="text-sm text-muted-foreground mb-3">
                          Il token sopra è un token "Utente". Per inviare messaggi serve trasformarlo in token "Pagina".
                        </p>
                        <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
                          <li>Apri il <strong>Graph API Explorer</strong> (link sotto)</li>
                          <li>Incolla il token del passaggio 4 nel campo <strong>Access Token</strong></li>
                          <li>Scrivi nella barra indirizzo: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">me/accounts</code></li>
                          <li>Premi <strong>Submit</strong></li>
                          <li>Cerca il <strong>nome della tua pagina</strong> nei risultati</li>
                          <li>Copia l'<code className="bg-green-200 dark:bg-green-800 px-1 rounded text-xs">access_token</code> specifico che trovi sotto il nome della pagina</li>
                        </ol>
                        <div className="bg-green-100 dark:bg-green-900/50 rounded p-2 mt-3 border border-green-300 dark:border-green-700">
                          <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                            ✅ QUELLO è il Token da usare in Coachale!
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mt-4">
                      <ExternalLinkButton href="https://business.facebook.com/settings">
                        Apri Business Manager
                      </ExternalLinkButton>
                      <ExternalLinkButton href="https://developers.facebook.com/tools/explorer/" variant="outline">
                        Apri Graph API Explorer
                      </ExternalLinkButton>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ExternalLinkButton href="https://developers.facebook.com/apps/">
                    Apri Meta for Developers
                  </ExternalLinkButton>
                  <ExternalLinkButton href="https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived" variant="outline">
                    Documentazione Token
                  </ExternalLinkButton>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Trova App Secret"
                description="L'App Secret e una chiave segreta che serve per verificare che i webhook provengano realmente da Meta."
                icon={Key}
                iconColor="bg-cyan-500"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Dove trovare l'App Secret:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Apri <strong>Meta for Developers</strong></li>
                    <li>Vai su <strong>"My Apps"</strong> e seleziona la tua app</li>
                    <li>Nel menu a sinistra, clicca <strong>"Settings" → "Basic"</strong></li>
                    <li>Trova il campo <strong>"App Secret"</strong></li>
                    <li>Clicca <strong>"Show"</strong> (dovrai confermare la password)</li>
                    <li>Copia la stringa alfanumerica</li>
                  </ol>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 mb-4">
                  <p className="text-sm font-mono">
                    Esempio App Secret: <span className="text-teal-600 font-bold">abc123def456ghi789jkl012</span>
                  </p>
                </div>
                <ExternalLinkButton href="https://developers.facebook.com/apps/">
                  Apri Meta for Developers
                </ExternalLinkButton>
              </StepCard>

              <StepCard
                number={6}
                title="Configura in Coachale"
                description="Ora hai tutte le credenziali. Inseriscile nel pannello API Keys di Coachale per completare il collegamento."
                icon={Settings}
                iconColor="bg-teal-500"
                link="/consultant/api-keys"
                linkText="Vai alle API Keys"
              >
                <div className="bg-red-50 dark:bg-red-950/40 rounded-lg p-4 border border-red-200 dark:border-red-800 mb-4">
                  <p className="text-sm font-medium mb-2 text-red-700 dark:text-red-300 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    IMPORTANTE: Configura i Webhook PRIMA di testare!
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400">
                    Il pulsante <strong>"Testa Connessione"</strong> in Coachale fallira se non hai ancora configurato i webhook 
                    su Meta for Developers (Sezione 2 di questa guida). I webhook permettono a Meta di comunicare con Coachale.
                  </p>
                  <div className="mt-3 p-2 bg-red-100 dark:bg-red-900/40 rounded border border-red-300 dark:border-red-700">
                    <p className="text-xs text-red-700 dark:text-red-300">
                      <strong>Ordine corretto:</strong> Prima completa la Sezione 2 (Webhook) → Poi torna qui per testare
                    </p>
                  </div>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Campi da compilare:</p>
                  <ul className="space-y-2">
                    <ChecklistItem>Apri API Keys → Tab <strong>"Instagram"</strong></ChecklistItem>
                    <ChecklistItem>Inserisci il <strong>Page ID</strong> (es: 123456789012345)</ChecklistItem>
                    <ChecklistItem>Inserisci l'<strong>Access Token</strong> (stringa lunga)</ChecklistItem>
                    <ChecklistItem>Inserisci l'<strong>App Secret</strong> (stringa alfanumerica)</ChecklistItem>
                    <ChecklistItem>Seleziona l'<strong>Agente WhatsApp</strong> da collegare</ChecklistItem>
                    <ChecklistItem>Clicca <strong>"Testa Connessione"</strong> per verificare</ChecklistItem>
                    <ChecklistItem>Se il test e verde, clicca <strong>"Salva"</strong></ChecklistItem>
                  </ul>
                </div>

                <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-3 border border-green-200 dark:border-green-800">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <CheckCircle2 className="h-4 w-4 inline mr-1" />
                    <strong>Test verde?</strong> Ottimo! Ora passa alla Sezione 2 per configurare i webhook e completare l'integrazione.
                  </p>
                </div>
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
                <strong>Cos'e un webhook?</strong> E come un "campanello" che avvisa Coachale ogni volta che ricevi un messaggio su Instagram. 
                Senza webhook, i messaggi non arriverebbero in tempo reale.
              </InfoBox>

              <StepCard
                number={1}
                title="Dove Configurare il Webhook"
                description="Il webhook si configura nella stessa pagina dove hai generato il token, oppure puoi accederci direttamente."
                icon={ExternalLink}
                iconColor="bg-teal-500"
              >
                <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mb-4">
                  <p className="text-sm font-medium mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Sei uscito e rientrato? Ecco come tornare alla pagina giusta:
                  </p>
                  <ol className="space-y-2 text-sm text-blue-700 dark:text-blue-300 list-decimal list-inside">
                    <li>Vai su <strong>developers.facebook.com</strong></li>
                    <li>Clicca <strong>"My Apps"</strong> in alto a destra</li>
                    <li>Seleziona la tua app (es: "Coachale Instagram Bot")</li>
                    <li>Nel menu a sinistra, cerca <strong>"Casi d'uso"</strong> (Use Cases)</li>
                    <li>Clicca su <strong>"Gestisci i messaggi e i contenuti su Instagram"</strong></li>
                    <li>Clicca il pulsante <strong>"Personalizza"</strong> (icona matita)</li>
                    <li>Scorri in basso fino al riquadro <strong>"3. Configura i webhooks"</strong></li>
                  </ol>
                </div>

                <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-3 border border-green-200 dark:border-green-800 mb-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <CheckCircle2 className="h-4 w-4 inline mr-1" />
                    <strong>Se sei ancora nella pagina del token:</strong> Scorri semplicemente in basso, il riquadro webhook e subito sotto!
                  </p>
                </div>

                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Procedura nel riquadro Webhook:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Inserisci il <strong>Callback URL</strong> (vedi passo 2 sotto)</li>
                    <li>Inserisci il <strong>Verify Token</strong> (vedi passo 3 sotto)</li>
                    <li>Clicca <strong>"Verifica e salva"</strong></li>
                    <li>Una volta salvato, clicca su <strong>"Gestisci"</strong> (o Edit Subscription)</li>
                    <li>Seleziona <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">messages</code> e <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">messaging_postbacks</code></li>
                  </ol>
                </div>
                <ExternalLinkButton href="https://developers.facebook.com/apps/">
                  Apri Meta for Developers
                </ExternalLinkButton>
              </StepCard>

              <StepCard
                number={2}
                title="Configura Callback URL"
                description="Il Callback URL e l'indirizzo del tuo server Coachale dove Meta inviera le notifiche dei messaggi."
                icon={Link2}
                iconColor="bg-cyan-500"
                badge="IMPORTANTE"
              >
                <div className="bg-gradient-to-r from-cyan-100 to-teal-100 dark:from-cyan-900/50 dark:to-teal-900/50 rounded-lg p-4 mb-4 border border-cyan-300 dark:border-cyan-700">
                  <p className="text-sm font-medium mb-2">Il tuo Callback URL (copia e incolla):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-cyan-700 dark:text-cyan-300 font-mono text-sm break-all flex-1 bg-white/50 dark:bg-gray-800/50 p-2 rounded border">
                      {typeof window !== 'undefined' ? `https://${window.location.host}/api/instagram/webhook` : 'https://tuodominio/api/instagram/webhook'}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={() => {
                        const url = `https://${window.location.host}/api/instagram/webhook`;
                        navigator.clipboard.writeText(url);
                      }}
                    >
                      Copia
                    </Button>
                  </div>
                </div>
                <ul className="space-y-2 mb-4">
                  <ChecklistItem>Il link deve essere <strong>HTTPS</strong> (SSL obbligatorio)</ChecklistItem>
                  <ChecklistItem>Assicurati che il server sia <strong>online</strong> quando configuri</ChecklistItem>
                </ul>
                <WarningBox>
                  <strong>Errore comune:</strong> Se il webhook non si verifica, controlla che il tuo server Coachale sia attivo. 
                  Meta prova a raggiungere l'URL immediatamente durante la configurazione.
                </WarningBox>
              </StepCard>

              <StepCard
                number={3}
                title="Imposta Verify Token"
                description="Il Verify Token e una password segreta che conferma che sei tu a configurare il webhook."
                icon={Key}
                iconColor="bg-teal-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Come funziona:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li><strong>Inventa</strong> una stringa segreta (es: <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded">mio_token_segreto_12345</code>)</li>
                    <li>Inseriscila in <strong>Meta for Developers</strong> nel campo "Verify Token"</li>
                    <li>Inserisci la <strong>STESSA</strong> stringa nelle API Keys di Coachale → Instagram</li>
                    <li>Le due stringhe devono essere <strong>identiche</strong>, altrimenti la verifica fallisce</li>
                  </ol>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-sm font-mono">
                    Esempio Verify Token: <span className="text-teal-600 font-bold">coachale_instagram_webhook_2024</span>
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Sottoscrivi agli Eventi"
                description="Scegli quali tipi di notifiche vuoi ricevere. I messaggi DM sono obbligatori."
                icon={Webhook}
                iconColor="bg-cyan-600"
                badge="OBBLIGATORIO"
                badgeVariant="destructive"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Sottoscrizioni obbligatorie:</p>
                  <ul className="space-y-2">
                    <ChecklistItem checked>
                      <code className="bg-cyan-100 dark:bg-cyan-900 px-1.5 py-0.5 rounded text-cyan-700 dark:text-cyan-300">messages</code> - Ricevi notifica quando arriva un DM
                    </ChecklistItem>
                    <ChecklistItem checked>
                      <code className="bg-cyan-100 dark:bg-cyan-900 px-1.5 py-0.5 rounded text-cyan-700 dark:text-cyan-300">messaging_postbacks</code> - Risposte ai bottoni interattivi
                    </ChecklistItem>
                  </ul>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2 text-muted-foreground">Sottoscrizioni opzionali:</p>
                  <ul className="space-y-1.5 text-sm text-muted-foreground">
                    <li>• <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">messaging_seen</code> - Sapere quando il messaggio e stato letto</li>
                    <li>• <code className="bg-gray-200 dark:bg-gray-700 px-1 rounded text-xs">messaging_referrals</code> - Link di riferimento</li>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Verifica e Testa"
                description="Verifica che il webhook funzioni inviando un messaggio di test."
                icon={CheckCircle2}
                iconColor="bg-teal-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Procedura di test:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>In Meta for Developers, clicca <strong>"Verify and Save"</strong></li>
                    <li>Se vedi <span className="text-green-600 font-medium">verde/success</span>, il webhook e attivo</li>
                    <li>Apri Instagram da un <strong>altro account</strong></li>
                    <li>Invia un DM al tuo account Business</li>
                    <li>Apri Coachale → <strong>Conversazioni → Instagram</strong></li>
                    <li>Verifica che il messaggio sia arrivato</li>
                  </ol>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href="/consultant/conversations">
                    <Button variant="outline" size="sm" className="gap-2">
                      <MessageCircle className="h-4 w-4" />
                      Vai alle Conversazioni
                    </Button>
                  </Link>
                  <ExternalLinkButton href="https://developers.facebook.com/docs/messenger-platform/webhooks" variant="outline">
                    Documentazione Webhooks
                  </ExternalLinkButton>
                </div>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              title="Funzionalita e Limiti"
              subtitle="Cosa puoi fare con l'integrazione Instagram DM e quali sono le limitazioni da conoscere"
              icon={Zap}
              gradient="bg-gradient-to-br from-cyan-50 to-teal-50 dark:from-cyan-950/30 dark:to-teal-950/30"
              borderColor="border-cyan-200 dark:border-cyan-800"
            >
              <StepCard
                number={1}
                title="La Finestra 24 Ore"
                description="Instagram impone una regola ferrea: puoi rispondere ai messaggi solo entro 24 ore dall'ultimo messaggio dell'utente."
                icon={Timer}
                iconColor="bg-amber-500"
                badge="LIMITE CRITICO"
                badgeVariant="destructive"
              >
                <WarningBox>
                  <strong>ATTENZIONE:</strong> Se l'utente non risponde entro 24 ore, NON potrai piu inviargli messaggi 
                  finche non ti scrive di nuovo. Questa e una policy di Instagram per prevenire spam.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4">
                  <p className="text-sm font-medium mb-3">Come funziona la finestra:</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm"><strong>Finestra APERTA</strong>: L'utente ti ha scritto nelle ultime 24h → Puoi rispondere</span>
                    </div>
                    <div className="flex items-center gap-3 p-2 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-sm"><strong>Finestra CHIUSA</strong>: Sono passate 24h → Devi aspettare che l'utente scriva</span>
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <ExternalLinkButton href="https://developers.facebook.com/docs/messenger-platform/policy/policy-overview" variant="outline">
                    Leggi le Policy Instagram Messaging
                  </ExternalLinkButton>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Rate Limit (200 DM/ora)"
                description="Instagram limita a 200 messaggi DM all'ora per prevenire spam. Coachale gestisce automaticamente questa limitazione."
                icon={Clock}
                iconColor="bg-orange-500"
                badge="200 DM/ora"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Cosa significa:</p>
                  <ul className="space-y-2">
                    <ChecklistItem>Puoi inviare massimo <strong>200 messaggi</strong> in un'ora</ChecklistItem>
                    <ChecklistItem>Il conteggio si <strong>resetta</strong> ogni ora</ChecklistItem>
                    <ChecklistItem>Se superi il limite, i messaggi vanno in <strong>coda</strong></ChecklistItem>
                    <ChecklistItem>Coachale invia automaticamente i messaggi in coda quando disponibile</ChecklistItem>
                  </ul>
                </div>
                <InfoBox>
                  Non ti preoccupare troppo di questo limite. Per la maggior parte degli utenti, 200 DM/ora sono piu che sufficienti. 
                  Coachale gestisce tutto automaticamente.
                </InfoBox>
              </StepCard>

              <StepCard
                number={3}
                title="Collegamento con Agente WhatsApp"
                description="L'agente Instagram riusa la configurazione AI dell'agente WhatsApp selezionato: personalita, istruzioni, knowledge base."
                icon={Bot}
                iconColor="bg-cyan-500"
                link="/consultant/whatsapp"
                linkText="Gestisci Agenti WhatsApp"
              >
                <InfoBox>
                  <strong>Perche riusiamo l'agente WhatsApp?</strong> Cosi puoi avere un unico agente AI che risponde in modo coerente 
                  su tutti i canali (WhatsApp, Instagram) con la stessa personalita e knowledge base.
                </InfoBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4">
                  <p className="text-sm font-medium mb-3">Cosa viene condiviso:</p>
                  <ul className="space-y-2">
                    <ChecklistItem checked>Personalita e tono di voce dell'agente</ChecklistItem>
                    <ChecklistItem checked>Istruzioni e comportamenti configurati</ChecklistItem>
                    <ChecklistItem checked>Knowledge Base e documenti caricati</ChecklistItem>
                    <ChecklistItem checked>Script di vendita e fasi configurate</ChecklistItem>
                  </ul>
                </div>
              </StepCard>

              <StepCard
                number={4}
                title="Story Replies e Mentions"
                description="L'agente risponde automaticamente quando qualcuno risponde alle tue storie o ti menziona nelle sue storie."
                icon={AtSign}
                iconColor="bg-teal-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Funzionalita disponibili:</p>
                  <ul className="space-y-2">
                    <ChecklistItem checked>
                      <strong>Story Reply</strong>: Qualcuno risponde alla tua storia → L'agente risponde nel DM
                    </ChecklistItem>
                    <ChecklistItem checked>
                      <strong>Story Mention</strong>: Qualcuno ti menziona nella sua storia → L'agente manda un DM di ringraziamento
                    </ChecklistItem>
                  </ul>
                </div>
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                  <p className="text-sm font-medium mb-2">Esempio risposta automatica:</p>
                  <p className="text-sm text-muted-foreground italic">
                    "Ciao! Ho visto che mi hai menzionato nella tua storia. Grazie mille per la condivisione! 
                    C'e qualcosa in cui posso aiutarti?"
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Comment-to-DM Automation"
                description="Invia un DM automatico quando qualcuno commenta un tuo post con una parola chiave specifica."
                icon={MessageCircle}
                iconColor="bg-cyan-600"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mb-4">
                  <p className="text-sm font-medium mb-3">Come funziona il Comment-to-DM:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Pubblichi un post con CTA: <em>"Commenta INFO per ricevere dettagli"</em></li>
                    <li>Un utente commenta: <strong>"INFO"</strong></li>
                    <li>L'agente invia automaticamente un DM con le informazioni</li>
                    <li>L'utente risponde → Inizia conversazione AI</li>
                  </ol>
                </div>
                <InfoBox>
                  Questa funzionalita e perfetta per <strong>lead generation</strong> dai post organici. 
                  Trasforma i commenti in conversazioni private dove l'AI puo qualificare il lead.
                </InfoBox>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={4}
              title="Troubleshooting - Problemi Comuni"
              subtitle="Soluzioni ai problemi piu frequenti durante la configurazione"
              icon={AlertCircle}
              gradient="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30"
              borderColor="border-amber-200 dark:border-amber-800"
            >
              <StepCard
                number={1}
                title="Caricamento Infinito o 'Impossibile collegare l'account'"
                description="La finestra di popup carica all'infinito o restituisce un errore generico subito dopo il login."
                icon={RefreshCw}
                iconColor="bg-amber-500"
                badge="COMUNE"
                badgeVariant="secondary"
              >
                <WarningBox>
                  <strong>Causa:</strong> Disallineamento nello stato della connessione ("Handshake failure"). 
                  Instagram crede di essere gia collegato alla Pagina Facebook, ma Facebook non ha ricevuto la conferma.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Soluzione (da smartphone):
                  </p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Apri l'<strong>app Instagram</strong> dallo smartphone</li>
                    <li>Vai su <strong>Modifica Profilo</strong> → <strong>Pagina</strong></li>
                    <li>Se la pagina risulta collegata, clicca <strong>"Scollega pagina"</strong> o <strong>"Disconnetti"</strong></li>
                    <li>Torna al computer e riavvia la procedura di collegamento</li>
                  </ol>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Il Chatbot/AI non risponde ai messaggi"
                description="L'account e collegato correttamente (spunta verde), ma l'AI non riceve i messaggi inviati dagli utenti."
                icon={MessageSquareX}
                iconColor="bg-red-500"
                badge="FREQUENTE"
                badgeVariant="destructive"
              >
                <WarningBox>
                  <strong>Causa:</strong> Manca il permesso specifico per l'accesso ai messaggi nelle impostazioni 
                  della privacy dell'app Instagram. I webhook non partono senza questo permesso.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Soluzione (da smartphone):
                  </p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Apri l'<strong>app Instagram</strong> dallo smartphone</li>
                    <li>Vai in <strong>Impostazioni e privacy</strong> → <strong>Messaggi e risposte alle storie</strong></li>
                    <li>Trova <strong>"Controlli per i messaggi"</strong></li>
                    <li>Attiva l'interruttore <strong>"Consenti l'accesso ai messaggi"</strong> (Allow Access to Messages)</li>
                  </ol>
                </div>
                <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-3 border border-green-200 dark:border-green-800 mt-4">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>Verifica:</strong> Dopo aver attivato, invia un messaggio di test da un altro account 
                    e verifica che appaia in Coachale → Conversazioni → Instagram.
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={3}
                title="Account non idoneo (Personal Account)"
                description="L'account non viene rilevato nella lista delle risorse collegabili o da errore di permessi insufficienti."
                icon={UserX}
                iconColor="bg-orange-500"
                badge="REQUISITO"
                badgeVariant="secondary"
              >
                <WarningBox>
                  <strong>Causa:</strong> L'account Instagram e impostato come "Personale". 
                  Le API di Meta funzionano <strong>SOLO</strong> con account Business o Creator.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4">
                  <p className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    Soluzione (da smartphone):
                  </p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Apri l'app Instagram → <strong>Impostazioni</strong></li>
                    <li>Vai su <strong>Tipo di account e strumenti</strong></li>
                    <li>Seleziona <strong>"Passa a un account per professionisti"</strong></li>
                    <li>Scegli <strong>Business</strong> o <strong>Creator</strong></li>
                    <li>Collega l'account a una <strong>Pagina Facebook</strong> durante il processo</li>
                  </ol>
                </div>
                <ExternalLinkButton href="https://help.instagram.com/502981923235522">
                  Guida ufficiale conversione account
                </ExternalLinkButton>
              </StepCard>

              <StepCard
                number={4}
                title="Permessi Facebook mancanti"
                description="Vedi la pagina Facebook ma non riesci a selezionarla o collegarla a Instagram."
                icon={ShieldX}
                iconColor="bg-red-600"
                badge="PERMESSI"
                badgeVariant="destructive"
              >
                <WarningBox>
                  <strong>Causa:</strong> L'utente che sta provando a fare il collegamento non ha i permessi di <strong>Amministratore</strong> 
                  sulla Pagina Facebook. Essere solo Editor o Moderatore <strong>NON basta</strong> per gestire le connessioni API.
                </WarningBox>
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border mt-4">
                  <p className="text-sm font-medium mb-3">Come verificare i permessi:</p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Vai su <strong>Facebook</strong> → la tua Pagina</li>
                    <li>Clicca <strong>Impostazioni Pagina</strong></li>
                    <li>Vai su <strong>"Nuova esperienza delle Pagine"</strong> → <strong>"Accesso alla Pagina"</strong></li>
                    <li>Verifica di avere <strong>"Facebook Access"</strong> completo (accesso amministratore)</li>
                  </ol>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-3 border border-blue-200 dark:border-blue-800 mt-4">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Suggerimento:</strong> Se non sei admin, chiedi al proprietario della Pagina di aggiungerti 
                    come Amministratore nelle impostazioni della Pagina.
                  </p>
                </div>
              </StepCard>

              <StepCard
                number={5}
                title="Errore 'Temporaneo' nella Verifica Account Developer"
                description="Durante la creazione dell'app Meta, la verifica telefonica mostra 'Si e verificato un errore temporaneo'."
                icon={AlertTriangle}
                iconColor="bg-purple-500"
                badge="META DEVELOPERS"
                badgeVariant="secondary"
              >
                <WarningBox>
                  <strong>Causa:</strong> E un blocco di sicurezza dei sistemi anti-spam di Meta che impedisce l'invio dell'SMS 
                  di verifica. <strong>Attendere NON risolve il problema</strong>.
                </WarningBox>
                
                <div className="bg-green-50 dark:bg-green-950/40 rounded-lg p-4 border border-green-200 dark:border-green-800 mt-4">
                  <p className="text-sm font-medium mb-3 text-green-800 dark:text-green-200 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Soluzione 1: Verifica con Carta di Credito (Consigliata)
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300 mb-3">
                    Metodo piu rapido - Meta considera la verifica bancaria piu affidabile di quella telefonica.
                  </p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Nella schermata di errore, guarda in basso</li>
                    <li>Clicca il link: <strong>"Puoi anche verificare il tuo account aggiungendo una carta di credito"</strong></li>
                    <li>Inserisci una carta valida (anche prepagata va bene)</li>
                    <li>Completa la procedura (transazione di prova a 0€ stornata subito)</li>
                    <li>L'account sara <strong>immediatamente verificato</strong> senza SMS</li>
                  </ol>
                </div>

                <div className="bg-blue-50 dark:bg-blue-950/40 rounded-lg p-4 border border-blue-200 dark:border-blue-800 mt-4">
                  <p className="text-sm font-medium mb-3 text-blue-800 dark:text-blue-200 flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Soluzione 2: Verifica tramite Profilo Facebook Personale
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
                    Se non vuoi usare la carta, verifica il numero dalle impostazioni Facebook.
                  </p>
                  <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
                    <li>Chiudi la scheda con l'errore su developers.facebook.com</li>
                    <li>Vai su <strong>Facebook</strong> → <strong>Impostazioni e privacy</strong> → <strong>Impostazioni</strong></li>
                    <li>Clicca <strong>"Centro gestione account"</strong> (Meta Accounts Center)</li>
                    <li>Vai su <strong>Dettagli personali</strong> → <strong>Informazioni di contatto</strong></li>
                    <li>Clicca <strong>"Aggiungi numero di cellulare"</strong></li>
                    <li>Inserisci il numero e conferma con il codice SMS (da qui funziona!)</li>
                    <li>Torna su <strong>developers.facebook.com</strong></li>
                    <li>Il sistema rilevera il numero gia verificato</li>
                  </ol>
                </div>
              </StepCard>

              <div className="flex flex-wrap gap-3 pt-4">
                <Link href="/consultant/api-keys">
                  <Button className="gap-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600">
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
                    <BookOpen className="h-4 w-4" />
                    Guida WhatsApp
                  </Button>
                </Link>
                <ExternalLinkButton href="https://developers.facebook.com/docs/messenger-platform/instagram" variant="outline">
                  Documentazione Meta
                </ExternalLinkButton>
              </div>
            </SectionCard>
          </div>
        </main>
      </div>
      
      <GuideFloatingAssistant 
        guideContext={{
          guideId: "guide-instagram",
          guideTitle: "Guida Instagram DM Integration",
          guideDescription: "Configura Instagram Business per ricevere e rispondere automaticamente ai DM con AI.",
          guideSections: ["Prerequisiti e Setup Account", "Configurazione Webhook", "Funzionalità e Limiti", "Troubleshooting - Problemi Comuni"]
        }}
      />
    </div>
  );
}
