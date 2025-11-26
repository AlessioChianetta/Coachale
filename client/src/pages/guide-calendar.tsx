import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuideSection } from "@/components/guides/GuideSection";
import { CalendarDays, Settings, Zap, Calendar, Link2, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuideCalendar() {
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
              <div className="p-3 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 rounded-xl">
                <BookOpen className="h-8 w-8 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Guida Google Calendar</h1>
                <p className="text-lg text-muted-foreground mt-1">Sincronizza e gestisci appuntamenti con Google Calendar</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <GuideSection
              icon={<Link2 className="h-6 w-6 text-blue-600" />}
              title="Collegamento Account Google"
              description="Come connettere il tuo Google Calendar"
              steps={[
                { title: "Vai alle impostazioni", content: "Vai su Google Calendar → Impostazioni Calendar per iniziare il processo di connessione.", actionText: "Configura Calendar", actionHref: "/consultant/calendar-settings" },
                { title: "Autorizza accesso", content: "Clicca 'Collega Google Calendar' e autorizza l'app ad accedere al tuo calendario. Usiamo OAuth2 sicuro." },
                { title: "Seleziona calendario", content: "Scegli quale calendario usare per le consulenze. Puoi usare il calendario principale o crearne uno dedicato." },
                { title: "Verifica connessione", content: "Il sistema mostrerà un segno verde quando la connessione è attiva e funzionante." }
              ]}
            />

            <GuideSection
              icon={<Zap className="h-6 w-6 text-violet-600" />}
              title="Sincronizzazione Eventi"
              description="Come funziona la sincronizzazione automatica"
              steps={[
                { title: "Sincronizzazione bidirezionale", content: "Gli eventi si sincronizzano in entrambe le direzioni: Google Calendar ↔ Piattaforma." },
                { title: "Aggiornamenti in tempo reale", content: "Se modifichi un appuntamento su Google Calendar, i cambiamenti appaiono istantaneamente nella piattaforma e viceversa." },
                { title: "Risoluzione conflitti", content: "Se ci sono sovrapposizioni, il sistema ti avvisa e ti permette di risolvere manualmente il conflitto." },
                { title: "Sync on-demand", content: "Puoi forzare una sincronizzazione manuale in qualsiasi momento dalle Impostazioni Calendar." }
              ]}
            />

            <GuideSection
              icon={<Settings className="h-6 w-6 text-gray-600" />}
              title="Gestione Disponibilità"
              description="Come impostare quando sei disponibile"
              steps={[
                { title: "Orari di lavoro", content: "Imposta i tuoi orari di lavoro predefiniti: es. Lun-Ven 9:00-18:00. Gli appuntamenti fuori orario verranno evidenziati." },
                { title: "Giorni non disponibili", content: "Blocca giorni specifici per ferie, eventi personali o formazione." },
                { title: "Buffer tra appuntamenti", content: "Imposta un buffer (es: 15 minuti) tra appuntamenti consecutivi per prepararti e fare pausa." },
                { title: "Slot personalizzati", content: "Definisci slot di disponibilità personalizzati per giorni specifici (es: martedì mattina solo per nuovi clienti)." }
              ]}
            />

            <GuideSection
              icon={<Calendar className="h-6 w-6 text-orange-600" />}
              title="Programmazione Consulenze"
              description="Come programmare appuntamenti con i clienti"
              steps={[
                { title: "Crea appuntamento", content: "Dal calendario, clicca su uno slot libero e seleziona il cliente. Imposta durata (30min, 1h, 2h).", actionText: "Vai al Calendario", actionHref: "/consultant/calendar" },
                { title: "Aggiungi Google Meet", content: "Il sistema crea automaticamente un link Google Meet per videochiamate se hai abilitato l'opzione." },
                { title: "Notifiche automatiche", content: "I clienti ricevono automaticamente email di conferma con data, ora e link Meet." },
                { title: "Promemoria", content: "Entrambi ricevete promemoria 24h e 1h prima dell'appuntamento per ridurre no-show." }
              ]}
            />

            <GuideSection
              icon={<CalendarDays className="h-6 w-6 text-emerald-600" />}
              title="Visualizzazione Calendario"
              description="Come navigare e usare il calendario"
              steps={[
                { title: "Viste multiple", content: "Passa tra vista Giorno, Settimana, Mese per vedere il tuo planning a diversi livelli di dettaglio." },
                { title: "Filtri per tipo", content: "Filtra appuntamenti per tipo: Consulenza iniziale, Follow-up, Sessione strategica, ecc." },
                { title: "Colori per cliente", content: "Ogni cliente ha un colore dedicato per identificare rapidamente i suoi appuntamenti nel calendario." },
                { title: "Riepilogo giornaliero", content: "Ogni mattina vedi un riepilogo degli appuntamenti della giornata con nomi clienti e note preparatorie." }
              ]}
            />

            <GuideSection
              icon={<Zap className="h-6 w-6 text-yellow-600" />}
              title="Integrazione Email"
              description="Come usare calendar con email automatiche"
              steps={[
                { title: "Email conferma automatica", content: "Quando crei un appuntamento, il cliente riceve automaticamente email di conferma con tutti i dettagli." },
                { title: "Reminder pre-consulenza", content: "24h prima, entrambi ricevete promemoria con link Meet e punti da discutere preparati." },
                { title: "Follow-up post-consulenza", content: "Dopo la consulenza, puoi inviare automaticamente riepilogo e prossimi step via email." },
                { title: "Rescheduling facile", content: "Se devi spostare un appuntamento, il sistema invia automaticamente notifica al cliente con nuova data." }
              ]}
            />
          </div>

          <Card className="mt-8 border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardHeader>
              <CardTitle>💡 Consigli per Gestione Tempo Efficace</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-blue-600">✓</span><span><strong>Time blocking:</strong> Blocca slot per lavoro profondo (es: 9-11 per planning strategico)</span></li>
                <li className="flex gap-2"><span className="text-blue-600">✓</span><span><strong>Batch simili:</strong> Raggruppa consulenze simili nello stesso giorno per maggiore efficienza</span></li>
                <li className="flex gap-2"><span className="text-blue-600">✓</span><span><strong>Buffer generosi:</strong> 15-30 minuti tra appuntamenti prevengono ritardi a catena</span></li>
                <li className="flex gap-2"><span className="text-blue-600">✓</span><span><strong>Review settimanale:</strong> Ogni domenica rivedi la settimana successiva e prepara materiali</span></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
