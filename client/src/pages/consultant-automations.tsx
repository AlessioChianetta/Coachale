import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  UserPlus, 
  Megaphone, 
  Zap, 
  KanbanSquare, 
  Settings, 
  FileText, 
  BarChart,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  ArrowRight,
  Clock,
  Send,
  ExternalLink,
  BookOpen,
  CheckCircle2,
  Play,
  Bot,
  Upload,
  Users,
  Phone,
  RefreshCw,
  Target,
  TestTube,
  Brain,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Loader2
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { PipelineKanban } from "@/components/automations/PipelineKanban";
import { AutomationRulesList } from "@/components/automations/AutomationRulesList";
import { TemplatesGrid } from "@/components/automations/TemplatesGrid";
import { AnalyticsDashboard } from "@/components/automations/AnalyticsDashboard";
import { SystemRulesViewer } from "@/components/automations/SystemRulesViewer";
import { Link } from "wouter";

function AutomationFlowVisual() {
  const steps = [
    { icon: UserPlus, label: "Lead Proattivi", color: "bg-blue-500", href: "/consultant/proactive-leads" },
    { icon: Megaphone, label: "Campagne", color: "bg-purple-500", href: "/consultant/campaigns" },
    { icon: MessageSquare, label: "Chat WhatsApp", color: "bg-green-500", href: "/consultant/whatsapp" },
    { icon: KanbanSquare, label: "Pipeline", color: "bg-orange-500", href: null },
    { icon: Settings, label: "Regole", color: "bg-red-500", href: null },
    { icon: FileText, label: "Template", color: "bg-indigo-500", href: null },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          {step.href ? (
            <Link href={step.href}>
              <div className="flex flex-col items-center cursor-pointer hover:opacity-80 transition-opacity">
                <div className={`${step.color} p-3 rounded-full text-white`}>
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs mt-1 text-center font-medium">{step.label}</span>
              </div>
            </Link>
          ) : (
            <div className="flex flex-col items-center">
              <div className={`${step.color} p-3 rounded-full text-white`}>
                <step.icon className="h-5 w-5" />
              </div>
              <span className="text-xs mt-1 text-center font-medium">{step.label}</span>
            </div>
          )}
          {index < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

function ContextualGuide() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">Guida al Sistema Automazioni</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {isOpen ? (
                  <>
                    <span className="text-sm">Nascondi</span>
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span className="text-sm">Mostra guida</span>
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Scopri come funziona il sistema di follow-up automatico
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <AutomationFlowVisual />
            
            <div className="grid gap-4 md:grid-cols-2 mt-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <div className="bg-orange-100 dark:bg-orange-900 p-2 rounded-lg">
                    <KanbanSquare className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Conversazioni Attive (Pipeline)</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Visualizza i lead che hanno già interagito via WhatsApp. 
                      Sono conversazioni POST-contatto, organizzate per stato (nuovo, in follow-up, convertito, ecc.).
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-lg">
                    <UserPlus className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Lead Proattivi vs Pipeline</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      I <strong>Lead Proattivi</strong> sono contatti PRE-contatto, non ancora raggiunti.
                      La <strong>Pipeline</strong> contiene solo chi ha già ricevuto/risposto ai messaggi WhatsApp.
                    </p>
                    <Link href="/consultant/proactive-leads">
                      <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
                        Vai a Lead Proattivi <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <div className="bg-red-100 dark:bg-red-900 p-2 rounded-lg">
                    <Clock className="h-5 w-5 text-red-600 dark:text-red-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Regole di Automazione</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Trigger automatici che inviano messaggi basandosi su stato e tempo.
                      Es: "Se nessuna risposta dopo 24h → invia reminder".
                      Definisci quando e cosa inviare automaticamente.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-white dark:bg-gray-900 rounded-lg border">
                  <div className="bg-indigo-100 dark:bg-indigo-900 p-2 rounded-lg">
                    <Send className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-sm">Template Messaggi</h4>
                    <p className="text-xs text-muted-foreground mt-1">
                      Modelli di messaggi pre-approvati da WhatsApp Business.
                      Le regole usano questi template per inviare follow-up automatici.
                      Personalizzabili con variabili dinamiche (nome, data, ecc.).
                    </p>
                    <Link href="/consultant/whatsapp/templates">
                      <Button variant="link" size="sm" className="h-auto p-0 mt-1 text-xs">
                        Gestisci Template WhatsApp <ExternalLink className="h-3 w-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-4 w-4 text-green-600" />
                <span className="font-semibold text-sm text-green-800 dark:text-green-200">Come funziona il flusso completo</span>
              </div>
              <p className="text-xs text-green-700 dark:text-green-300">
                1. Importi <strong>Lead Proattivi</strong> (CSV/manuale) → 
                2. Crei <strong>Campagne</strong> per invio massivo → 
                3. I lead rispondono e diventano <strong>Conversazioni Attive</strong> → 
                4. Le <strong>Regole</strong> monitorano lo stato e inviano <strong>Template</strong> automaticamente → 
                5. Monitora tutto dagli <strong>Analytics</strong>
              </p>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function FullFlowGuide() {
  const [isOpen, setIsOpen] = useState(false);

  const steps = [
    {
      number: 1,
      title: "Configura il tuo Agente WhatsApp",
      icon: Bot,
      color: "bg-purple-500",
      description: "Prima di tutto, hai bisogno di un 'agente' che risponda ai messaggi WhatsApp.",
      details: [
        "Vai nella sezione 'WhatsApp' dal menu laterale",
        "Clicca su 'Impostazioni Agente' o 'Nuovo Agente'",
        "Inserisci le credenziali Twilio (Account SID, Auth Token, numero WhatsApp)",
        "Configura il comportamento dell'agente (nome, personalità, istruzioni)",
        "Salva le impostazioni - l'agente è pronto!"
      ],
      tip: "Puoi avere più agenti per gestire diversi tipi di conversazioni (es: vendite, supporto, info)."
    },
    {
      number: 2,
      title: "Importa i tuoi Lead Proattivi",
      icon: Upload,
      color: "bg-blue-500",
      description: "I 'lead proattivi' sono persone che vuoi contattare tu per primo.",
      details: [
        "Vai su 'Lead Proattivi' (menu laterale o tab in alto)",
        "Clicca 'Importa CSV' oppure 'Aggiungi Manualmente'",
        "Se usi CSV: il file deve avere colonne come nome, cognome, telefono, email",
        "Verifica che i numeri di telefono siano corretti (formato italiano +39...)",
        "I lead importati appariranno nella lista 'Da Contattare'"
      ],
      tip: "Puoi anche aggiungere note e tag per organizzare meglio i tuoi lead."
    },
    {
      number: 3,
      title: "Crea una Campagna",
      icon: Megaphone,
      color: "bg-orange-500",
      description: "Le campagne inviano messaggi in massa ai tuoi lead proattivi.",
      details: [
        "Vai su 'Campagne' (tab in alto)",
        "Clicca 'Nuova Campagna'",
        "Scegli un nome per la campagna (es: 'Promozione Gennaio')",
        "Seleziona i lead da includere (puoi filtrare per tag o stato)",
        "Scegli il template del messaggio da inviare",
        "Pianifica l'invio (subito o data/ora futura)",
        "Avvia la campagna!"
      ],
      tip: "Inizia con pochi lead per testare, poi scala gradualmente."
    },
    {
      number: 4,
      title: "I Lead Rispondono e Diventano 'Conversazioni'",
      icon: MessageSquare,
      color: "bg-green-500",
      description: "Quando un lead risponde al messaggio, diventa una conversazione attiva.",
      details: [
        "Il lead riceve il messaggio WhatsApp",
        "Se risponde, il sistema crea automaticamente una 'conversazione'",
        "L'agente AI risponde in automatico (se abilitato)",
        "La conversazione appare nella 'Pipeline' qui sotto",
        "Puoi vedere lo stato: nuovo, in follow-up, interessato, convertito..."
      ],
      tip: "Puoi sempre disabilitare l'AI e rispondere manualmente dalla chat WhatsApp."
    },
    {
      number: 5,
      title: "Configura le Regole di Follow-up",
      icon: Settings,
      color: "bg-red-500",
      description: "Le regole inviano messaggi automatici basandosi su tempo e stato.",
      details: [
        "Vai sul tab 'Regole' qui in questa pagina",
        "Clicca 'Nuova Regola' o 'Crea con AI'",
        "Esempio regola: 'Se nessuna risposta dopo 24 ore → invia reminder'",
        "Imposta: trigger (tempo/evento), template da usare, numero max tentativi",
        "Attiva la regola con lo switch",
        "Il sistema controlla automaticamente ogni ora e invia i messaggi"
      ],
      tip: "Usa 'Crea con AI' per descrivere in parole semplici cosa vuoi fare."
    },
    {
      number: 6,
      title: "Prepara i Template dei Messaggi",
      icon: FileText,
      color: "bg-indigo-500",
      description: "I template sono modelli di messaggio pre-scritti usati dalle regole.",
      details: [
        "Vai sul tab 'Template' qui in questa pagina",
        "Clicca 'Nuovo Template' o 'Crea con AI'",
        "Scrivi il testo del messaggio (es: 'Ciao {{nome}}, ti ricontattiamo per...')",
        "Puoi usare variabili come {{nome}}, {{data}}, {{prodotto}}",
        "I template vengono usati sia dalle campagne che dalle regole automatiche"
      ],
      tip: "Crea template diversi per ogni fase: primo contatto, reminder, offerta speciale..."
    },
    {
      number: 7,
      title: "Monitora i Risultati",
      icon: BarChart,
      color: "bg-teal-500",
      description: "Controlla come stanno andando le tue automazioni.",
      details: [
        "Vai sul tab 'Analytics' qui in questa pagina",
        "Vedi quanti messaggi sono stati inviati, consegnati, letti",
        "Controlla quante conversioni hai ottenuto",
        "Identifica quali regole funzionano meglio",
        "Ottimizza le tue strategie in base ai dati"
      ],
      tip: "Controlla gli analytics almeno una volta a settimana per migliorare i risultati."
    }
  ];

  const testingSteps = [
    {
      number: 1,
      title: "Aggiungi te stesso come lead di test",
      description: "Vai su 'Lead Proattivi' e aggiungi il tuo numero di telefono come nuovo lead."
    },
    {
      number: 2,
      title: "Crea una campagna di test",
      description: "Crea una campagna con solo il tuo lead e un messaggio semplice di prova."
    },
    {
      number: 3,
      title: "Invia il messaggio",
      description: "Avvia la campagna. Dovresti ricevere un messaggio WhatsApp entro pochi secondi."
    },
    {
      number: 4,
      title: "Rispondi al messaggio",
      description: "Rispondi qualcosa. Il sistema creerà automaticamente una conversazione."
    },
    {
      number: 5,
      title: "Verifica la pipeline",
      description: "Torna qui e controlla che la tua conversazione appaia nella pipeline."
    },
    {
      number: 6,
      title: "Testa le regole",
      description: "Crea una regola di test (es: dopo 1 ora senza risposta) e verifica che funzioni."
    }
  ];

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="mb-6">
      <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <CardTitle className="text-lg">Guida Completa Passo-Passo</CardTitle>
            </div>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                {isOpen ? (
                  <>
                    <span className="text-sm">Nascondi</span>
                    <ChevronUp className="h-4 w-4" />
                  </>
                ) : (
                  <>
                    <span className="text-sm">Mostra guida completa</span>
                    <ChevronDown className="h-4 w-4" />
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          <CardDescription>
            Impara come configurare e testare tutto il sistema dall'inizio alla fine
          </CardDescription>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Target className="h-5 w-5 text-purple-600" />
                I 7 Passi per Configurare il Sistema
              </h3>
              
              <div className="space-y-4">
                {steps.map((step) => (
                  <div key={step.number} className="bg-white dark:bg-gray-900 rounded-lg border p-4">
                    <div className="flex items-start gap-4">
                      <div className={`${step.color} text-white rounded-full w-10 h-10 flex items-center justify-center font-bold text-lg shrink-0`}>
                        {step.number}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <step.icon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                          <h4 className="font-semibold">{step.title}</h4>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">{step.description}</p>
                        
                        <ul className="space-y-1.5 mb-3">
                          {step.details.map((detail, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                        
                        <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded text-sm">
                          <span className="text-amber-600 font-medium">Suggerimento:</span>
                          <span className="text-amber-700 dark:text-amber-300">{step.tip}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <TestTube className="h-5 w-5 text-purple-600" />
                Come Testare il Sistema (Passo-Passo)
              </h3>
              
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 rounded-lg border border-purple-200 dark:border-purple-800 p-4">
                <p className="text-sm text-muted-foreground mb-4">
                  Prima di usare il sistema con i clienti reali, testalo usando il tuo numero di telefono:
                </p>
                
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {testingSteps.map((step) => (
                    <div key={step.number} className="bg-white dark:bg-gray-900 rounded-lg p-3 border">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="bg-purple-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                          {step.number}
                        </div>
                        <h5 className="font-medium text-sm">{step.title}</h5>
                      </div>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-green-50 dark:bg-green-950/30 rounded border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span className="font-medium text-sm text-green-800 dark:text-green-200">Quando tutto funziona:</span>
                  </div>
                  <p className="text-xs text-green-700 dark:text-green-300">
                    Se hai ricevuto i messaggi, visto le conversazioni nella pipeline e le regole hanno inviato i follow-up automatici, 
                    il sistema è configurato correttamente! Puoi iniziare ad importare i lead reali.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t pt-6">
              <h3 className="font-semibold text-lg flex items-center gap-2 mb-4">
                <RefreshCw className="h-5 w-5 text-purple-600" />
                Cosa Succede Automaticamente?
              </h3>
              
              <div className="grid gap-4 md:grid-cols-2">
                <div className="bg-white dark:bg-gray-900 rounded-lg border p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    Ogni Ora
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>- Il sistema controlla tutte le conversazioni attive</li>
                    <li>- Verifica se qualche regola deve scattare</li>
                    <li>- Invia automaticamente i messaggi di follow-up</li>
                    <li>- Aggiorna gli stati nella pipeline</li>
                  </ul>
                </div>

                <div className="bg-white dark:bg-gray-900 rounded-lg border p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-yellow-500" />
                    Quando Arriva un Messaggio
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>- Il sistema riceve il messaggio via Twilio</li>
                    <li>- Trova o crea la conversazione</li>
                    <li>- L'agente AI risponde (se abilitato)</li>
                    <li>- Aggiorna lo stato nella pipeline</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t">
              <Link href="/consultant/proactive-leads">
                <Button variant="outline" size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Vai a Lead Proattivi
                </Button>
              </Link>
              <Link href="/consultant/campaigns">
                <Button variant="outline" size="sm" className="gap-2">
                  <Megaphone className="h-4 w-4" />
                  Vai a Campagne
                </Button>
              </Link>
              <Link href="/consultant/whatsapp">
                <Button variant="outline" size="sm" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Vai a WhatsApp
                </Button>
              </Link>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function AILogsViewer() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ai-evaluation-logs"],
    queryFn: async () => {
      const response = await fetch("/api/followup/ai-logs?limit=50", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch AI logs");
      return response.json();
    },
  });

  const decisionConfig: Record<string, { icon: any; color: string; label: string }> = {
    send_now: { icon: Send, color: "text-green-600 bg-green-100", label: "Invia Ora" },
    schedule: { icon: Clock, color: "text-blue-600 bg-blue-100", label: "Pianifica" },
    skip: { icon: XCircle, color: "text-yellow-600 bg-yellow-100", label: "Salta" },
    stop: { icon: AlertTriangle, color: "text-red-600 bg-red-100", label: "Stop" },
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-red-600">
          Errore nel caricamento dei log AI
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          Log Decisioni AI Follow-up
        </CardTitle>
        <CardDescription>
          Visualizza le decisioni prese dall'AI per i follow-up automatici
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data?.logs?.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nessuna decisione AI registrata. I log appariranno quando l'AI valuterà le conversazioni per i follow-up.
          </div>
        ) : (
          <div className="space-y-4">
            {data?.logs?.map((item: any) => {
              const log = item.log;
              const conversation = item.conversation;
              const agent = item.agent;
              const lead = item.lead;
              const config = decisionConfig[log.decision] || decisionConfig.skip;
              const DecisionIcon = config.icon;
              const leadName = lead?.firstName || lead?.lastName 
                ? `${lead.firstName || ''} ${lead.lastName || ''}`.trim()
                : null;
              
              return (
                <div key={log.id} className="border rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.color}`}>
                        <DecisionIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium">
                            {leadName || conversation?.phoneNumber || "Lead"}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            via {agent?.agentName || "Agente"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
                            {config.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            Confidenza: {Math.round((log.confidenceScore || 0) * 100)}%
                          </span>
                          {log.wasExecuted && (
                            <CheckCircle className="h-3 w-3 text-green-500" />
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-right">
                      {format(new Date(log.createdAt), "dd MMM HH:mm", { locale: it })}
                    </div>
                  </div>
                  
                  <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded border">
                    <p className="text-sm font-medium text-purple-700 dark:text-purple-400 mb-1">
                      Ragionamento AI:
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {log.reasoning}
                    </p>
                  </div>
                  
                  {log.conversationContext && (
                    <Collapsible className="mt-2">
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800">
                        <ChevronDown className="h-3 w-3" />
                        Contesto Conversazione
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs">
                        <div className="grid grid-cols-2 gap-2">
                          <div><strong>Stato:</strong> {log.conversationContext.currentState}</div>
                          <div><strong>Giorni silenzio:</strong> {log.conversationContext.daysSilent}</div>
                          <div><strong>Follow-up inviati:</strong> {log.conversationContext.followupCount}</div>
                          <div><strong>Canale:</strong> {log.conversationContext.channel}</div>
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              );
            })}
          </div>
        )}
        
        <div className="mt-4 text-center text-sm text-muted-foreground">
          Totale: {data?.total || 0} valutazioni AI
        </div>
      </CardContent>
    </Card>
  );
}

export default function ConsultantAutomationsPage() {
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
          <div className="max-w-7xl mx-auto">
            <NavigationTabs
              tabs={[
                { label: "Lead Proattivi", href: "/consultant/proactive-leads", icon: UserPlus },
                { label: "Campagne", href: "/consultant/campaigns", icon: Megaphone },
                { label: "Automazioni", href: "/consultant/automations", icon: Zap },
              ]}
            />

            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Sistema Automazioni Follow-up
              </h1>
              <p className="text-muted-foreground mt-2">
                Gestisci le regole di follow-up automatico e monitora la pipeline lead
              </p>
            </div>

            <ContextualGuide />
            <FullFlowGuide />

            <Tabs defaultValue="pipeline" className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="pipeline" className="flex items-center gap-2">
                  <KanbanSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Conversazioni Attive</span>
                </TabsTrigger>
                <TabsTrigger value="regole" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Regole</span>
                </TabsTrigger>
                <TabsTrigger value="template" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Template</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="ai-logs" className="flex items-center gap-2">
                  <Brain className="h-4 w-4" />
                  <span className="hidden sm:inline">Log AI</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pipeline">
                <PipelineKanban />
              </TabsContent>

              <TabsContent value="regole">
                <div className="space-y-6">
                  <SystemRulesViewer />
                  <AutomationRulesList />
                </div>
              </TabsContent>

              <TabsContent value="template">
                <TemplatesGrid />
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsDashboard />
              </TabsContent>

              <TabsContent value="ai-logs">
                <AILogsViewer />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
