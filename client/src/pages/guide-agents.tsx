import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bot, 
  ArrowRight,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  Smartphone,
  Rocket,
  GraduationCap,
  Settings,
  Zap,
  MessageSquare,
  Palette,
  Brain,
  Plug
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

export default function GuideAgents() {
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
              <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-4 rounded-2xl shadow-lg">
                <BookOpen className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                  Guida Setup Agenti WhatsApp
                </h1>
                <p className="text-muted-foreground mt-1">
                  Crea e configura agenti AI WhatsApp con il wizard in 4 step
                </p>
              </div>
            </div>

            <SectionCard
              sectionNumber={1}
              totalSections={5}
              title="Creazione Nuovo Agente (Wizard)"
              subtitle="Come creare un nuovo agente passo passo"
              icon={Zap}
              gradient="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30"
              borderColor="border-green-200 dark:border-green-800"
            >
              <StepCard
                number={1}
                title="Vai su Setup Agenti"
                description="Accedi alla sezione per gestire i tuoi agenti WhatsApp AI."
                icon={Bot}
                iconColor="bg-green-500"
                link="/consultant/whatsapp"
                linkText="Configura Agenti"
              />

              <StepCard
                number={2}
                title="Step 1: Configurazione Base"
                description="Inserisci le informazioni base del nuovo agente."
                icon={Settings}
                iconColor="bg-emerald-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Nome agente (es: 'Receptionist Marco')</ChecklistItem>
                  <ChecklistItem>Tipo agente (Reattivo, Proattivo, Educativo)</ChecklistItem>
                  <ChecklistItem>Modalita integrazione (WhatsApp+AI o Solo AI)</ChecklistItem>
                  <ChecklistItem>Credenziali Twilio (se WhatsApp+AI)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Step 2: Disponibilita"
                description="Configura quando l'agente e attivo."
                icon={Settings}
                iconColor="bg-teal-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Orari di lavoro (es: Lun-Ven 9-18)</ChecklistItem>
                  <ChecklistItem>Messaggio fuori orario</ChecklistItem>
                  <ChecklistItem>Funzionalita abilitate (prenotazione, obiezioni, upselling)</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={4}
                title="Step 3: Brand Voice"
                description="Definisci l'identita del tuo business."
                icon={Palette}
                iconColor="bg-cyan-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Nome business e descrizione</ChecklistItem>
                  <ChecklistItem>Bio consulente</ChecklistItem>
                  <ChecklistItem>Mission, Vision, Valori</ChecklistItem>
                  <ChecklistItem>USP (Unique Selling Proposition)</ChecklistItem>
                  <ChecklistItem>Target e anti-target</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={5}
                title="Step 4: Istruzioni AI"
                description="Configura il comportamento dell'intelligenza artificiale."
                icon={Brain}
                iconColor="bg-blue-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Template istruzioni (Receptionist, Setter, Educativo)</ChecklistItem>
                  <ChecklistItem>Personalita AI (Amico fidato, Consulente esperto, Coach)</ChecklistItem>
                  <ChecklistItem>Istruzioni custom aggiuntive</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={2}
              totalSections={5}
              title="Tipi di Agente"
              subtitle="Quando usare quale tipo di agente"
              icon={Bot}
              gradient="bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/30 dark:to-violet-950/30"
              borderColor="border-purple-200 dark:border-purple-800"
            >
              <StepCard
                number={1}
                title="Agente REATTIVO (Receptionist)"
                description="Per rispondere a chi ti contatta spontaneamente."
                icon={Smartphone}
                iconColor="bg-purple-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2">Comportamento:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>Aspetta messaggi in arrivo</li>
                    <li>Risponde automaticamente</li>
                    <li>Qualifica il lead con domande</li>
                    <li>Prenota appuntamenti nel calendario</li>
                  </ul>
                  <p className="text-sm font-medium mt-3">Ideale per:</p>
                  <p className="text-sm text-muted-foreground">Landing page, QR code, campagne dove il lead inizia la conversazione</p>
                </div>
              </StepCard>

              <StepCard
                number={2}
                title="Agente PROATTIVO (Setter)"
                description="Per contattare lead che hai importato."
                icon={Rocket}
                iconColor="bg-orange-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2">Comportamento:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>Invia primo messaggio programmato</li>
                    <li>Fa follow-up automatici</li>
                    <li>Usa template personalizzati</li>
                    <li>Persiste fino a risposta o disqualificazione</li>
                  </ul>
                  <p className="text-sm font-medium mt-3">Ideale per:</p>
                  <p className="text-sm text-muted-foreground">Lead da form, Facebook Ads, liste importate</p>
                </div>
              </StepCard>

              <StepCard
                number={3}
                title="Agente EDUCATIVO (Advisor)"
                description="Per fornire informazioni senza vendere."
                icon={GraduationCap}
                iconColor="bg-blue-500"
              >
                <div className="bg-white/60 dark:bg-gray-800/60 rounded-lg p-4 border">
                  <p className="text-sm font-medium mb-2">Comportamento:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>Risponde a domande informative</li>
                    <li>Fornisce contenuti formativi</li>
                    <li>NON prenota appuntamenti</li>
                    <li>NON fa vendita aggressiva</li>
                  </ul>
                  <p className="text-sm font-medium mt-3">Ideale per:</p>
                  <p className="text-sm text-muted-foreground">Supporto clienti esistenti, FAQ automatiche, contenuti educativi</p>
                </div>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={3}
              totalSections={5}
              title="Modalita Integrazione"
              subtitle="WhatsApp+AI vs Solo AI"
              icon={Plug}
              gradient="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30"
              borderColor="border-blue-200 dark:border-blue-800"
            >
              <StepCard
                number={1}
                title="WhatsApp + AI (Richiede Twilio)"
                description="Collegato a numero WhatsApp Business reale."
                icon={MessageSquare}
                iconColor="bg-green-500"
                badge="PRODUZIONE"
                badgeVariant="default"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem checked>Riceve messaggi WhatsApp reali</ChecklistItem>
                  <ChecklistItem checked>Invia risposte automatiche</ChecklistItem>
                  <ChecklistItem checked>Collegato a numero WhatsApp Business</ChecklistItem>
                  <ChecklistItem checked>Per comunicazione con clienti reali</ChecklistItem>
                </ul>
                <WarningBox>
                  Richiede: Account Twilio attivo, Numero WhatsApp Business, Credenziali API configurate
                </WarningBox>
              </StepCard>

              <StepCard
                number={2}
                title="Solo AI (Senza Twilio)"
                description="Chat interna per test e simulazioni."
                icon={Bot}
                iconColor="bg-purple-500"
                badge="TEST/DEMO"
                badgeVariant="secondary"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem checked>Chat interna solo nell'app</ChecklistItem>
                  <ChecklistItem checked>Per test e simulazioni</ChecklistItem>
                  <ChecklistItem checked>Per usare AI senza WhatsApp</ChecklistItem>
                  <ChecklistItem checked>Nessuna credenziale richiesta</ChecklistItem>
                </ul>
              </StepCard>
            </SectionCard>

            <SectionCard
              sectionNumber={4}
              totalSections={5}
              title="Configurazione Twilio"
              subtitle="Come ottenere e inserire le credenziali Twilio"
              icon={Settings}
              gradient="bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/30 dark:to-amber-950/30"
              borderColor="border-orange-200 dark:border-orange-800"
            >
              <StepCard
                number={1}
                title="Creare account Twilio"
                description="Vai su twilio.com, registrati e completa la verifica."
                icon={Settings}
                iconColor="bg-orange-500"
              />

              <StepCard
                number={2}
                title="Ottenere Account SID"
                description="Dashboard → Account Info → Account SID. Inizia con 'AC...' ed e lungo circa 34 caratteri."
                icon={CheckCircle2}
                iconColor="bg-amber-500"
              />

              <StepCard
                number={3}
                title="Ottenere Auth Token"
                description="Dashboard → Account Info → Auth Token. Clicca 'Show' per vedere il token."
                icon={CheckCircle2}
                iconColor="bg-yellow-500"
              />

              <StepCard
                number={4}
                title="Ottenere numero WhatsApp"
                description="Phone Numbers → Buy a Number → Seleziona 'WhatsApp Enabled'. Oppure usa il Sandbox per test gratuiti."
                icon={Smartphone}
                iconColor="bg-green-500"
              />

              <StepCard
                number={5}
                title="Configurare Webhook"
                description="Il sistema genera automaticamente un URL webhook. Copia l'URL in Twilio → Messaging → WhatsApp Sandbox → 'When a message comes in'."
                icon={Plug}
                iconColor="bg-blue-500"
              />
            </SectionCard>

            <SectionCard
              sectionNumber={5}
              totalSections={5}
              title="Brand Voice e Istruzioni AI"
              subtitle="Personalizzare la voce e il comportamento dell'agente"
              icon={Palette}
              gradient="bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/30 dark:to-rose-950/30"
              borderColor="border-pink-200 dark:border-pink-800"
            >
              <StepCard
                number={1}
                title="Informazioni Business"
                description="Compila tutti i campi del Brand Voice."
                icon={Palette}
                iconColor="bg-pink-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Nome business: Come ti chiami</ChecklistItem>
                  <ChecklistItem>Descrizione: Cosa fai in 1-2 frasi</ChecklistItem>
                  <ChecklistItem>Bio consulente: Chi sei e la tua esperienza</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={2}
                title="Target e Anti-Target"
                description="Specifica chi vuoi aiutare e chi no."
                icon={CheckCircle2}
                iconColor="bg-rose-500"
              >
                <ul className="space-y-1.5">
                  <ChecklistItem>Chi aiuti: Il tuo cliente ideale</ChecklistItem>
                  <ChecklistItem>Chi NON aiuti: Chi non e in target</ChecklistItem>
                </ul>
              </StepCard>

              <StepCard
                number={3}
                title="Personalita AI"
                description="Scegli il tono di voce del tuo agente."
                icon={Brain}
                iconColor="bg-purple-500"
              >
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-300">
                    Amico fidato - Empatico, usa 'tu'
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300">
                    Consulente esperto - Professionale, usa 'Lei'
                  </Badge>
                  <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-300">
                    Coach motivazionale - Energico, positivo
                  </Badge>
                </div>
              </StepCard>
            </SectionCard>

            <Card className="bg-gradient-to-br from-gray-50 to-slate-50 dark:from-gray-900/50 dark:to-slate-900/50 border-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="h-5 w-5 text-green-600" />
                  Accesso Rapido
                </CardTitle>
                <CardDescription>
                  Vai direttamente alla configurazione agenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Link href="/consultant/whatsapp">
                    <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                      <Bot className="h-5 w-5 text-green-600" />
                      <div className="text-left">
                        <div className="font-medium">Setup Agenti</div>
                        <div className="text-xs text-muted-foreground">Crea e configura agenti</div>
                      </div>
                    </Button>
                  </Link>
                  <Link href="/consultant/whatsapp/agents/chat">
                    <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3">
                      <MessageSquare className="h-5 w-5 text-blue-600" />
                      <div className="text-left">
                        <div className="font-medium">Chat Agenti</div>
                        <div className="text-xs text-muted-foreground">Testa i tuoi agenti</div>
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
