import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuideSection } from "@/components/guides/GuideSection";
import { GraduationCap, ClipboardList, BookOpen, Award, TrendingUp, BookOpen as BookOpenIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function GuideUniversity() {
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
              <div className="p-3 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-xl">
                <BookOpenIcon className="h-8 w-8 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white">Guida La Mia Università</h1>
                <p className="text-lg text-muted-foreground mt-1">Sistema completo per gestire formazione e crescita dei tuoi clienti</p>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <GuideSection
              icon={<GraduationCap className="h-6 w-6 text-amber-600" />}
              title="Navigazione Corsi"
              description="Come organizzare e navigare i percorsi formativi"
              steps={[
                { title: "Struttura a trimestri", content: "L'università è divisa in trimestri. Ogni trimestre contiene moduli tematici specifici.", actionText: "Vai all'Università", actionHref: "/consultant/university" },
                { title: "Moduli e lezioni", content: "Ogni modulo contiene lezioni progressive. I clienti devono completarle in ordine per sbloccare le successive." },
                { title: "Assegna percorsi", content: "Puoi assegnare trimestri specifici ai clienti in base al loro livello e obiettivi." },
                { title: "Monitora progressi", content: "Vedi in tempo reale quali clienti hanno completato quali lezioni e a che punto sono del percorso." }
              ]}
            />

            <GuideSection
              icon={<ClipboardList className="h-6 w-6 text-cyan-600" />}
              title="Gestione Esercizi"
              description="Come creare e assegnare esercizi ai clienti"
              steps={[
                { title: "Crea esercizio da template", content: "Usa gli Esercizi Modello per creare rapidamente esercizi standardizzati.", actionText: "Vedi Template", actionHref: "/consultant/exercise-templates" },
                { title: "Personalizza per cliente", content: "Vai su Esercizi → Crea Esercizio. Personalizza domande, durata e criteri di valutazione per ogni cliente.", actionText: "Crea Esercizio", actionHref: "/consultant/exercises" },
                { title: "Imposta scadenze", content: "Assegna una data di scadenza per mantenere il cliente focalizzato e motivato." },
                { title: "Valuta e fornisci feedback", content: "Quando il cliente invia l'esercizio, valutalo e fornisci feedback dettagliato per la crescita." }
              ]}
            />

            <GuideSection
              icon={<TrendingUp className="h-6 w-6 text-green-600" />}
              title="Tracciamento Progressi"
              description="Come monitorare l'evoluzione dei clienti"
              steps={[
                { title: "Dashboard progressi", content: "Ogni cliente ha una dashboard che mostra: lezioni completate, esercizi fatti, voti ottenuti, streak giorni." },
                { title: "Sistema a livelli", content: "I clienti guadagnano punti esperienza completando lezioni ed esercizi. Avanzano di livello: Studente → Esperto → Mentor → Master." },
                { title: "Streak e gamification", content: "Traccia quanti giorni consecutivi il cliente è attivo. Gli streak mantengono l'engagement alto." },
                { title: "Report periodici", content: "Genera report mensili automatici sui progressi del cliente da condividere nelle consulenze." }
              ]}
            />

            <GuideSection
              icon={<Award className="h-6 w-6 text-yellow-600" />}
              title="Certificati e Badge"
              description="Come riconoscere i traguardi raggiunti"
              steps={[
                { title: "Certificati automatici", content: "Quando un cliente completa un trimestre, genera automaticamente un certificato PDF personalizzato." },
                { title: "Badge per obiettivi", content: "Assegna badge quando il cliente raggiunge milestone specifici: 10 esercizi completati, 30 giorni di streak, ecc." },
                { title: "Showcase achievements", content: "I clienti possono vedere tutti i loro certificati e badge nella loro area personale." },
                { title: "Motivazione continua", content: "Usa certificati e badge come sistema di ricompensa per mantenere alta la motivazione." }
              ]}
            />
          </div>

          <Card className="mt-8 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader>
              <CardTitle>💡 Consigli per Massimizzare l'Apprendimento</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Micro-learning:</strong> Lezioni brevi (10-15 min) hanno completion rate più alto</span></li>
                <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Esercizi pratici:</strong> Ogni lezione dovrebbe avere un esercizio pratico associato</span></li>
                <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Feedback costruttivo:</strong> Non dare solo voti, spiega cosa migliorare e come</span></li>
                <li className="flex gap-2"><span className="text-amber-600">✓</span><span><strong>Celebra i successi:</strong> Riconosci pubblicamente i traguardi per motivare anche gli altri</span></li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
