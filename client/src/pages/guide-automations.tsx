import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  UserPlus, 
  Megaphone, 
  Zap, 
  Settings, 
  FileText, 
  BarChart,
  MessageSquare,
  ArrowRight,
  Clock,
  BookOpen,
  CheckCircle2,
  Bot,
  Upload,
  RefreshCw,
  Target,
  TestTube
} from "lucide-react";
import { Link } from "wouter";

function AutomationFlowVisual() {
  const steps = [
    { icon: UserPlus, label: "Lead Proattivi", color: "bg-blue-500" },
    { icon: Megaphone, label: "Campagne", color: "bg-purple-500" },
    { icon: MessageSquare, label: "Chat WhatsApp", color: "bg-green-500" },
    { icon: Settings, label: "Regole", color: "bg-red-500" },
    { icon: FileText, label: "Template", color: "bg-indigo-500" },
    { icon: BarChart, label: "Analytics", color: "bg-teal-500" },
  ];

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-4">
      {steps.map((step, index) => (
        <div key={step.label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`${step.color} p-3 rounded-full text-white`}>
              <step.icon className="h-5 w-5" />
            </div>
            <span className="text-xs mt-1 text-center font-medium">{step.label}</span>
          </div>
          {index < steps.length - 1 && (
            <ArrowRight className="h-4 w-4 mx-2 text-muted-foreground" />
          )}
        </div>
      ))}
    </div>
  );
}

export default function GuideAutomations() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        "Vai sulla pagina Automazioni e sul tab 'Regole'",
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
        "Vai sulla pagina Automazioni e sul tab 'Template'",
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
        "Vai sulla pagina Automazioni e sul tab 'Analytics'",
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
      description: "Vai sulla pagina Automazioni e controlla che la tua conversazione appaia nella pipeline."
    },
    {
      number: 6,
      title: "Testa le regole",
      description: "Crea una regola di test (es: dopo 1 ora senza risposta) e verifica che funzioni."
    }
  ];

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
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-purple-100 dark:bg-purple-900 p-3 rounded-lg">
                <BookOpen className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Guida Sistema Automazioni</h1>
                <p className="text-muted-foreground">Impara come configurare e testare il sistema di follow-up automatico</p>
              </div>
            </div>

            <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20 dark:border-purple-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Come Funziona il Sistema
                </CardTitle>
                <CardDescription>
                  Il flusso completo delle automazioni WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <AutomationFlowVisual />
                <p className="text-sm text-muted-foreground text-center mt-4">
                  1. Importi <strong>Lead</strong> → 2. Crei <strong>Campagne</strong> → 
                  3. I lead rispondono e diventano <strong>Conversazioni</strong> → 
                  4. Le <strong>Regole</strong> inviano <strong>Template</strong> automaticamente → 
                  5. Monitora tutto dagli <strong>Analytics</strong>
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-purple-600" />
                  I 7 Passi per Configurare il Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TestTube className="h-5 w-5 text-purple-600" />
                  Come Testare il Sistema (Passo-Passo)
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-purple-600" />
                  Cosa Succede Automaticamente?
                </CardTitle>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <div className="flex flex-wrap gap-2">
              <Link href="/consultant/proactive-leads">
                <Button variant="outline" size="sm" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Vai a Lead Proattivi
                </Button>
              </Link>
              <Link href="/consultant/automations">
                <Button variant="outline" size="sm" className="gap-2">
                  <Zap className="h-4 w-4" />
                  Vai a Automazioni
                </Button>
              </Link>
              <Link href="/consultant/whatsapp">
                <Button variant="outline" size="sm" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Vai a WhatsApp
                </Button>
              </Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
