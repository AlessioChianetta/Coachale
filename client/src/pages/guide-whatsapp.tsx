import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuideSection } from "@/components/guides/GuideSection";
import { 
  MessageSquare, 
  Bot, 
  UserPlus, 
  Megaphone, 
  PenSquare,
  BarChart3,
  Settings,
  BookOpen
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuideWhatsApp() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
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
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-green-500/10 to-blue-500/10 rounded-xl">
                <BookOpen className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                  Guida WhatsApp Business
                </h1>
                <p className="text-lg text-muted-foreground mt-1">
                  Impara a usare tutte le funzionalità WhatsApp per automatizzare il tuo business
                </p>
              </div>
            </div>
          </div>

          {/* Panoramica */}
          <Card className="mb-8 bg-gradient-to-br from-green-50 to-blue-50 dark:from-green-950/20 dark:to-blue-950/20 border-green-200 dark:border-green-800">
            <CardHeader>
              <CardTitle className="text-2xl">📱 Panoramica Sistema WhatsApp</CardTitle>
              <CardDescription>
                Il sistema WhatsApp ti permette di automatizzare completamente le conversazioni con i tuoi lead e clienti
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <h3 className="font-bold text-green-600 dark:text-green-400 mb-2">🎯 Campagne</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Crea campagne marketing con uncini personalizzati per ogni fonte di lead
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <h3 className="font-bold text-blue-600 dark:text-blue-400 mb-2">🤖 Automazione</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Gli agenti intelligenti inviano messaggi personalizzati automaticamente
                  </p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-800 rounded-lg">
                  <h3 className="font-bold text-purple-600 dark:text-purple-400 mb-2">📊 Analytics</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Monitora conversion rate e performance di ogni campagna in tempo reale
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sezioni Guide */}
          <div className="grid md:grid-cols-2 gap-6">
            <GuideSection
              icon={<Megaphone className="h-6 w-6 text-amber-600" />}
              title="Gestione Campagne"
              description="Come creare e configurare campagne marketing efficaci"
              steps={[
                {
                  title: "Crea una nuova campagna",
                  content: "Vai su Lead & Campagne → Campagne Marketing e clicca 'Nuova Campagna'. Scegli un nome descrittivo come 'Facebook Ads Q1 2025'.",
                  actionText: "Vai alle Campagne",
                  actionHref: "/consultant/campaigns"
                },
                {
                  title: "Configura l'uncino",
                  content: "L'uncino è la frase che cattura l'attenzione. Es: 'Automatizza le tue prenotazioni con un QR code'. Sarà usato in tutti i messaggi della campagna.",
                },
                {
                  title: "Imposta obiettivi e desideri",
                  content: "Definisci lo stato ideale del lead (es: 'Demo richiesta') e i desideri impliciti (es: 'Ridurre personale in sala').",
                },
                {
                  title: "Seleziona template WhatsApp",
                  content: "Scegli i template messaggi da usare per apertura e follow-up. Se non selezioni nulla, userà quelli dell'agente predefinito.",
                  actionText: "Gestisci Template",
                  actionHref: "/consultant/whatsapp/custom-templates/list"
                }
              ]}
            />

            <GuideSection
              icon={<UserPlus className="h-6 w-6 text-emerald-600" />}
              title="Gestione Lead"
              description="Come importare e gestire i tuoi lead"
              steps={[
                {
                  title: "Importa lead da CSV",
                  content: "Clicca 'Importa Lead' e carica il tuo file CSV con Nome, Cognome, Telefono. Seleziona la campagna di provenienza per applicare automaticamente uncino e obiettivi.",
                  actionText: "Importa Lead",
                  actionHref: "/consultant/proactive-leads"
                },
                {
                  title: "Assegna a una campagna",
                  content: "Quando selezioni una campagna durante l'import, tutti i lead erediteranno automaticamente uncino, obiettivi e template della campagna.",
                },
                {
                  title: "Programma il primo contatto",
                  content: "Scegli quando contattare ogni lead. Per lead 'freddi' aspetta 24h, per lead 'caldi' contatta subito.",
                },
                {
                  title: "Monitora lo stato",
                  content: "Segui l'evoluzione: Pending → Contacted → Responded → Converted. Ogni cambio di stato è tracciato automaticamente.",
                }
              ]}
            />

            <GuideSection
              icon={<PenSquare className="h-6 w-6 text-purple-600" />}
              title="Template Messaggi"
              description="Come creare template personalizzati con variabili dinamiche"
              steps={[
                {
                  title: "Crea un template custom",
                  content: "Vai su Impostazioni WhatsApp → Template Messaggi. Scrivi il messaggio usando variabili come {nome_lead}, {uncino}, {obiettivi}.",
                  actionText: "Crea Template",
                  actionHref: "/consultant/whatsapp/custom-templates/list"
                },
                {
                  title: "Usa variabili dinamiche",
                  content: "Le variabili vengono sostituite automaticamente: {nome_lead} diventa 'Mario', {uncino} diventa l'uncino della campagna.",
                },
                {
                  title: "Anteprima in tempo reale",
                  content: "Usa la preview per vedere come apparirà il messaggio con dati reali prima di salvare il template.",
                },
                {
                  title: "Assegna template alle campagne",
                  content: "Puoi assegnare template specifici a ogni campagna o usare i template predefiniti dell'agente.",
                }
              ]}
            />

            <GuideSection
              icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              title="Analytics & Report"
              description="Come monitorare le performance delle tue campagne"
              steps={[
                {
                  title: "Visualizza metriche campagna",
                  content: "Nella sezione Campagne Marketing, clicca sull'icona analytics per vedere: Lead totali, Lead convertiti, Conversion rate, Tempo medio risposta.",
                  actionText: "Vedi Analytics",
                  actionHref: "/consultant/campaigns"
                },
                {
                  title: "Confronta campagne",
                  content: "Usa la vista tabella per confrontare performance di diverse campagne e capire quale funziona meglio.",
                },
                {
                  title: "Ottimizza basandoti sui dati",
                  content: "Se una campagna ha conversion rate basso, prova a modificare l'uncino o cambiare i template messaggi.",
                },
                {
                  title: "Monitora il ROI",
                  content: "Calcola il ritorno sull'investimento confrontando il numero di lead convertiti con il costo della campagna pubblicitaria.",
                }
              ]}
            />

            <GuideSection
              icon={<Bot className="h-6 w-6 text-blue-600" />}
              title="Agenti Intelligenti"
              description="Come configurare gli agenti WhatsApp automatici"
              steps={[
                {
                  title: "Configura l'agente",
                  content: "Vai su Conversazioni WhatsApp → Agenti Intelligenti. Imposta nome agente, numero WhatsApp Twilio e orari di lavoro.",
                  actionText: "Configura Agenti",
                  actionHref: "/consultant/ai-agents"
                },
                {
                  title: "Imposta valori predefiniti",
                  content: "Definisci obiettivi, desideri e uncino predefiniti che verranno usati se un lead non ha una campagna associata.",
                },
                {
                  title: "Assegna template",
                  content: "Collega i template WhatsApp all'agente: apertura, follow-up gentile, follow-up valore, follow-up finale.",
                },
                {
                  title: "Abilita invio automatico",
                  content: "L'agente invierà messaggi automaticamente secondo la programmazione dei lead, rispettando gli orari di lavoro impostati.",
                }
              ]}
            />

            <GuideSection
              icon={<Settings className="h-6 w-6 text-gray-600" />}
              title="Configurazione Agenti"
              description="Come connettere WhatsApp Business e Twilio"
              steps={[
                {
                  title: "Registra account Twilio",
                  content: "Vai su twilio.com e crea un account. Ottieni le credenziali: Account SID, Auth Token e numero WhatsApp Business.",
                },
                {
                  title: "Inserisci credenziali",
                  content: "Vai su Impostazioni WhatsApp → Configurazione Agenti e inserisci le credenziali Twilio ottenute.",
                  actionText: "Configura Account",
                  actionHref: "/consultant/whatsapp"
                },
                {
                  title: "Verifica connessione",
                  content: "Invia un messaggio di test per verificare che tutto funzioni correttamente.",
                },
                {
                  title: "Configura webhook",
                  content: "Il sistema configura automaticamente i webhook Twilio per ricevere messaggi in arrivo e aggiornare lo stato delle conversazioni.",
                }
              ]}
            />
          </div>

          {/* Footer */}
          <Card className="mt-8 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle>💡 Consigli per il Successo</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span><strong>Uncino specifico:</strong> Usa uncini diversi per ogni tipo di campagna. Es: Facebook → "Automatizza X", Google → "Risparmia tempo con Y"</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span><strong>Test A/B:</strong> Crea 2 campagne simili con uncini diversi e confronta quale converte meglio</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span><strong>Follow-up costante:</strong> I lead rispondono meglio dopo 2-3 follow-up. Non fermarti al primo messaggio!</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-blue-600">✓</span>
                  <span><strong>Monitora conversion rate:</strong> Un buon conversion rate è sopra il 15%. Se sei sotto, prova a modificare i template</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
