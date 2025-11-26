import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuideSection } from "@/components/guides/GuideSection";
import { Users, Target, CheckSquare, Calendar, BarChart3, BookOpen } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuideClients() {
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
              <div className="p-3 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl">
                <BookOpen className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Guida Gestione Clienti</h1>
                <p className="text-lg text-muted-foreground mt-1">Tutto quello che serve per gestire i tuoi clienti efficacemente</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <GuideSection
              icon={<Users className="h-6 w-6 text-purple-600" />}
              title="Anagrafica Clienti"
              description="Come gestire i dati e informazioni dei clienti"
              steps={[
                { title: "Aggiungi nuovo cliente", content: "Vai su Clienti → Aggiungi Cliente. Inserisci nome, email, telefono e altre informazioni di base.", actionText: "Gestisci Clienti", actionHref: "/consultant/clients" },
                { title: "Profilo completo", content: "Ogni cliente ha un profilo con: dati anagrafici, stato attuale, obiettivi, storico consulenze, esercizi assegnati." },
                { title: "Tag e categorizzazione", content: "Usa tag per organizzare i clienti: VIP, Attivo, In pausa, Nuovo, ecc. Facilita filtri e ricerche." },
                { title: "Note e cronologia", content: "Tieni traccia di tutte le interazioni, note importanti e decisioni prese durante le consulenze." }
              ]}
            />

            <GuideSection
              icon={<Target className="h-6 w-6 text-green-600" />}
              title="Tracciamento Stato"
              description="Come monitorare l'evoluzione del cliente"
              steps={[
                { title: "Definisci stato attuale", content: "Vai su Clienti → Stato Clienti. Descrivi dove si trova ora il cliente (es: 'Fatturato 50k/anno, stress alto').", actionText: "Gestisci Stati", actionHref: "/consultant/client-state" },
                { title: "Imposta stato ideale", content: "Definisci dove vuole arrivare (es: 'Fatturato 100k/anno, work-life balance')." },
                { title: "Identifica ostacoli", content: "Documenta gli ostacoli principali che impediscono al cliente di raggiungere lo stato ideale." },
                { title: "Aggiorna regolarmente", content: "Rivedi e aggiorna lo stato dopo ogni consulenza per tracciare i progressi effettivi." }
              ]}
            />

            <GuideSection
              icon={<CheckSquare className="h-6 w-6 text-rose-600" />}
              title="Task e Feedback"
              description="Come assegnare compiti e raccogliere feedback"
              steps={[
                { title: "Crea task post-consulenza", content: "Vai su Clienti → Task & Feedback. Crea task specifici da completare prima della prossima consulenza.", actionText: "Gestisci Task", actionHref: "/consultant/client-daily" },
                { title: "Imposta priorità", content: "Classifica task come: Urgente, Alta, Media, Bassa. Il cliente vedrà la lista ordinata per priorità." },
                { title: "Raccogli riflessioni giornaliere", content: "Il cliente può inserire riflessioni giornaliere: 3 cose per cui è grato, obiettivi del giorno, cosa migliorare." },
                { title: "Monitora completion rate", content: "Vedi quanti task il cliente completa per capire il livello di engagement e commitment." }
              ]}
            />

            <GuideSection
              icon={<Calendar className="h-6 w-6 text-orange-600" />}
              title="Programmazione Appuntamenti"
              description="Come gestire le consulenze"
              steps={[
                { title: "Crea appuntamento", content: "Vai su Clienti → Appuntamenti. Programma data, ora, durata e tipo di consulenza.", actionText: "Vedi Appuntamenti", actionHref: "/consultant/appointments" },
                { title: "Integrazione Google Calendar", content: "Gli appuntamenti si sincronizzano automaticamente con Google Calendar se hai collegato il tuo account." },
                { title: "Note pre-consulenza", content: "Prepara note e punti da discutere prima della consulenza per massimizzare l'efficacia." },
                { title: "Riepilogo post-consulenza", content: "Dopo la consulenza, genera un riepilogo automatico con AI da inviare al cliente via email." }
              ]}
            />

            <GuideSection
              icon={<BarChart3 className="h-6 w-6 text-blue-600" />}
              title="Metriche Performance"
              description="Come misurare i risultati dei clienti"
              steps={[
                { title: "Dashboard metriche", content: "Ogni cliente ha metriche chiave: completion rate esercizi, streak giorni attivo, progressi università." },
                { title: "Confronta periodi", content: "Visualizza grafici che mostrano evoluzione nel tempo: questo mese vs mese scorso, trimestre attuale vs precedente." },
                { title: "Identifica pattern", content: "Cerca correlazioni: i clienti con streak più alto hanno anche completion rate più alto?" },
                { title: "Report automatici", content: "Genera report mensili/trimestrali da condividere con il cliente per mostrare progressi tangibili." }
              ]}
            />

            <GuideSection
              icon={<Target className="h-6 w-6 text-indigo-600" />}
              title="Roadmap Personalizzata"
              description="Come creare percorsi di crescita su misura"
              steps={[
                { title: "Visualizza roadmap", content: "Ogni cliente ha una roadmap Orbitale con fasi, gruppi e item da completare in 6-12 mesi." },
                { title: "Segna progressi", content: "Man mano che il cliente completa item della roadmap, segnali come completati con eventuali voti." },
                { title: "Aggiungi note", content: "Per ogni item completato, aggiungi note su cosa è andato bene e cosa migliorare." },
                { title: "Celebra milestone", content: "Quando il cliente completa una fase intera, celebra il successo e pianifica la fase successiva." }
              ]}
            />
          </div>

          <Card className="mt-8 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
            <CardHeader>
              <CardTitle>💡 Best Practices Gestione Clienti</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-purple-600">✓</span><span><strong>Documenta tutto:</strong> Note dettagliate oggi ti fanno risparmiare ore domani</span></li>
                <li className="flex gap-2"><span className="text-purple-600">✓</span><span><strong>Check-in settimanali:</strong> Brevi check-in regolari sono meglio di lunghe sessioni mensili</span></li>
                <li className="flex gap-2"><span className="text-purple-600">✓</span><span><strong>Celebra i piccoli win:</strong> Riconosci ogni progresso, non solo i grandi traguardi</span></li>
                <li className="flex gap-2"><span className="text-purple-600">✓</span><span><strong>Sii proattivo:</strong> Anticipa problemi e bisogni del cliente prima che te li chieda</span></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
