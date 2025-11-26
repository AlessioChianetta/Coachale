import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuideSection } from "@/components/guides/GuideSection";
import { Mail, Settings, Inbox, Sparkles, ListTodo, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuideEmail() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {isMobile ? (
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      ) : (
        <Sidebar role="consultant" />
      )}

      <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-3 bg-gradient-to-br from-sky-500/10 to-purple-500/10 rounded-xl">
                <BookOpen className="h-8 w-8 text-sky-600 dark:text-sky-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Guida Email Marketing</h1>
                <p className="text-lg text-muted-foreground mt-1">Automatizza le tue email e rimani in contatto con i clienti</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <GuideSection
              icon={<Settings className="h-6 w-6 text-slate-600" />}
              title="Configurazione SMTP"
              description="Come collegare il tuo account email"
              steps={[
                { title: "Scegli provider email", content: "Puoi usare Gmail, Outlook, o qualsiasi servizio SMTP. Gmail è il più semplice da configurare." },
                { title: "Ottieni credenziali SMTP", content: "Per Gmail: Vai su Impostazioni → Sicurezza → Password per le app. Genera una password dedicata per l'app." },
                { title: "Inserisci configurazione", content: "Vai su Email Marketing → Configurazione SMTP e inserisci: Server (smtp.gmail.com), Porta (587), Email e Password app.", actionText: "Configura SMTP", actionHref: "/consultant/smtp-settings" },
                { title: "Testa la connessione", content: "Invia un'email di test per verificare che tutto funzioni correttamente. Se ricevi l'email, sei pronto!" }
              ]}
            />

            <GuideSection
              icon={<ListTodo className="h-6 w-6 text-pink-600" />}
              title="Task Automatici"
              description="Come programmare email automatiche"
              steps={[
                { title: "Crea task email", content: "Vai su Email Marketing → Task Automatici. Crea task per inviare email a intervalli regolari ai tuoi clienti.", actionText: "Gestisci Task", actionHref: "/consultant/tasks" },
                { title: "Imposta frequenza", content: "Scegli ogni quanto inviare: giornaliero, settimanale, o personalizzato. Es: ogni lunedì mattina alle 9:00." },
                { title: "Seleziona destinatari", content: "Scegli quali clienti riceveranno l'email: tutti, solo attivi, o filtrati per tag/stato." },
                { title: "Monitora invii", content: "Ogni invio viene registrato nello Storico Invii dove puoi vedere successi e eventuali errori." }
              ]}
            />

            <GuideSection
              icon={<Sparkles className="h-6 w-6 text-fuchsia-600" />}
              title="Personalizzazione AI"
              description="Come usare l'AI per email personalizzate"
              steps={[
                { title: "Configura API Gemini", content: "Vai su Email Marketing → Configurazione AI e inserisci la tua API key di Google Gemini.", actionText: "Configura AI", actionHref: "/consultant/ai-config" },
                { title: "Usa variabili dinamiche", content: "Nei template email usa {{nome_cliente}}, {{ultimo_obiettivo}}, {{stato_attuale}} per personalizzare ogni email." },
                { title: "Genera contenuti", content: "L'AI può generare automaticamente email di follow-up basate sullo stato e progresso del cliente." },
                { title: "Ottimizza il tono", content: "L'AI adatta il tono del messaggio in base alla relazione e al livello di engagement del cliente." }
              ]}
            />

            <GuideSection
              icon={<Inbox className="h-6 w-6 text-violet-600" />}
              title="Storico Invii"
              description="Come monitorare le email inviate"
              steps={[
                { title: "Visualizza log completo", content: "Vai su Email Marketing → Storico Invii per vedere tutte le email inviate dal sistema.", actionText: "Vedi Storico", actionHref: "/consultant/email-logs" },
                { title: "Filtra per cliente", content: "Cerca email inviate a un cliente specifico per vedere tutta la cronologia di comunicazione." },
                { title: "Verifica stato invio", content: "Ogni email mostra se è stata inviata con successo, aperta dal cliente, o se ci sono stati errori." },
                { title: "Risolvi problemi", content: "Se vedi errori frequenti, controlla le credenziali SMTP o i limiti di invio del tuo provider email." }
              ]}
            />
          </div>

          <Card className="mt-8 border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20">
            <CardHeader>
              <CardTitle>💡 Best Practices Email Marketing</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Oggetto accattivante:</strong> I primi 50 caratteri dell'oggetto sono i più importanti per il tasso di apertura</span></li>
                <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Personalizza sempre:</strong> Email personalizzate hanno tassi di apertura 2-3x superiori</span></li>
                <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Evita spam:</strong> Non inviare più di 2-3 email a settimana per cliente</span></li>
                <li className="flex gap-2"><span className="text-sky-600">✓</span><span><strong>Call to action chiara:</strong> Ogni email deve avere un'azione specifica (es: Prenota, Rispondi, Compila)</span></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
