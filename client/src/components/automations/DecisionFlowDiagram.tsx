import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowDown, 
  Brain,
  ChevronRight,
  MessageSquare,
  Clock,
  User,
  Zap,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Calendar
} from "lucide-react";

function AIThinkingStep({ 
  step, 
  title, 
  description,
  icon: Icon
}: { 
  step: number;
  title: string;
  description: string;
  icon: React.ElementType;
}) {
  return (
    <div className="flex items-start gap-3 p-3 bg-purple-50/50 dark:bg-purple-950/30 rounded-lg border border-purple-200 dark:border-purple-800">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center text-purple-600 dark:text-purple-400">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs text-purple-500 font-medium">Passo {step}</span>
          <span className="font-semibold text-sm text-purple-700 dark:text-purple-300">{title}</span>
        </div>
        <p className="text-xs mt-1 text-purple-600/80 dark:text-purple-400/80">{description}</p>
      </div>
    </div>
  );
}

function DecisionOption({
  decision,
  label,
  description,
  color,
  icon: Icon
}: {
  decision: string;
  label: string;
  description: string;
  color: "green" | "blue" | "yellow" | "red";
  icon: React.ElementType;
}) {
  const colorClasses = {
    green: "bg-green-100 border-green-300 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400",
    blue: "bg-blue-100 border-blue-300 text-blue-700 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-400",
    yellow: "bg-yellow-100 border-yellow-300 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-800 dark:text-yellow-400",
    red: "bg-red-100 border-red-300 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400",
  };
  
  const badgeClasses = {
    green: "bg-green-600",
    blue: "bg-blue-600",
    yellow: "bg-yellow-600",
    red: "bg-red-600",
  };
  
  return (
    <div className={`p-2 rounded-lg border ${colorClasses[color]} flex items-center gap-2`}>
      <Icon className="h-4 w-4 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Badge className={`${badgeClasses[color]} text-white text-xs`}>{decision}</Badge>
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className="text-xs opacity-75 mt-0.5">{description}</p>
      </div>
    </div>
  );
}

export function DecisionFlowDiagram() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          <CardTitle className="text-lg">Sistema AI "Dipendente Umano"</CardTitle>
        </div>
        <CardDescription>
          L'AI analizza ogni lead come farebbe un consulente esperto, senza regole rigide predefinite.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {/* Entry point */}
          <div className="flex items-center justify-center gap-2 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <span className="text-lg">📥</span>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Lead da valutare
            </span>
            <ChevronRight className="h-4 w-4 text-blue-500" />
            <span className="text-xs text-blue-600 dark:text-blue-400">
              Valutazione ogni 5 minuti
            </span>
          </div>

          <div className="flex justify-center py-1">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* AI Analysis Section */}
          <div className="border-l-4 border-purple-500 pl-3 space-y-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-semibold text-purple-600 uppercase tracking-wide">
                Analisi AI Intelligente
              </span>
              <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
                Nuovo Sistema
              </Badge>
            </div>

            <div className="p-3 bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/50 dark:to-indigo-950/50 rounded-lg border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🧑‍💼</span>
                <span className="font-semibold text-sm text-purple-700 dark:text-purple-300">
                  "Marco" - Consulente AI Esperto
                </span>
              </div>
              <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                L'AI analizza la situazione come un dipendente umano con 15 anni di esperienza.
                <br />
                <strong>Nessuna regola rigida</strong> - usa giudizio e contesto per decidere.
              </p>
              
              <div className="space-y-2">
                <AIThinkingStep
                  step={1}
                  title="Legge la Chat"
                  description="Analizza tutti i messaggi, distinguendo template, risposte lead, messaggi liberi"
                  icon={MessageSquare}
                />
                <AIThinkingStep
                  step={2}
                  title="Valuta il Timing"
                  description="Considera quanto tempo è passato, se il lead ha mai risposto, quanti follow-up abbiamo fatto"
                  icon={Clock}
                />
                <AIThinkingStep
                  step={3}
                  title="Interpreta i Segnali"
                  description="Ha chiesto prezzo? Ha detto no? È interessato? Analizza il comportamento"
                  icon={User}
                />
                <AIThinkingStep
                  step={4}
                  title="Decide l'Azione"
                  description="Come farebbe un consulente esperto, decide cosa fare basandosi sul contesto"
                  icon={Zap}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-center py-1">
            <ArrowDown className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Decision Options */}
          <div className="border-l-4 border-gray-400 pl-3">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-gray-600" />
              <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Possibili Decisioni
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <DecisionOption
                decision="INVIA ORA"
                label="send_now"
                description="Il momento è perfetto, invia subito"
                color="green"
                icon={CheckCircle2}
              />
              <DecisionOption
                decision="PROGRAMMA"
                label="schedule"
                description="Aspetta e programma per dopo"
                color="blue"
                icon={Calendar}
              />
              <DecisionOption
                decision="SALTA"
                label="skip"
                description="Non serve azione, lead attivo"
                color="yellow"
                icon={PauseCircle}
              />
              <DecisionOption
                decision="STOP"
                label="stop"
                description="Lead perso o non interessato"
                color="red"
                icon={XCircle}
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-start gap-2">
              <span className="text-lg">💡</span>
              <div>
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  Perché questo sistema è migliore?
                </p>
                <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                  Le vecchie regole codificate erano rigide e potevano sbagliare in casi particolari.
                  <br />
                  L'AI valuta <strong>tutto il contesto</strong>: storico chat, tipo messaggio (template vs libero),
                  timing, segnali del lead, e prende decisioni più intelligenti e contestualizzate.
                </p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
