import { Button } from "@/components/ui/button";
import { CalendarDays, BookOpen, CheckSquare, Target, DollarSign, TrendingUp, Briefcase, Lightbulb, Users, FileText, FileQuestion, ListChecks, Sparkles, Clock, BarChart3, GraduationCap, Map } from "lucide-react";
import { AIMode, ConsultantType } from "./AIAssistant";
import { PageContext } from "@/hooks/use-page-context";

interface QuickActionsProps {
  mode: AIMode;
  consultantType?: ConsultantType;
  onAction: (action: string) => void;
  disabled?: boolean;
  pageContext?: PageContext;
}

export function QuickActions({ mode, consultantType, onAction, disabled = false, pageContext }: QuickActionsProps) {
  const lessonActions = [
    { label: `Riassumi questa lezione`, icon: FileText, gradient: "from-blue-500 to-blue-600" },
    { label: `Spiegami i concetti chiave`, icon: Lightbulb, gradient: "from-purple-500 to-purple-600" },
    { label: `Quiz su questa lezione`, icon: FileQuestion, gradient: "from-green-500 to-green-600" },
    { label: `Suggerisci esercizi correlati`, icon: ListChecks, gradient: "from-orange-500 to-orange-600" },
  ];

  const exerciseActions = [
    { label: `Aiutami a capire l'esercizio`, icon: Lightbulb, gradient: "from-purple-500 to-purple-600" },
    { label: `Guidami passo-passo`, icon: ListChecks, gradient: "from-blue-500 to-blue-600" },
    { label: `Dammi un suggerimento`, icon: Sparkles, gradient: "from-green-500 to-green-600" },
    { label: `Verifica le mie risposte`, icon: CheckSquare, gradient: "from-orange-500 to-orange-600" },
  ];

  const exercisesListActions = [
    { label: "Quale esercizio dovrei fare per primo?", icon: Target, gradient: "from-indigo-500 to-indigo-600" },
    { label: "Mostrami gli esercizi in scadenza", icon: Clock, gradient: "from-red-500 to-red-600" },
    { label: "Strategia per completare tutto", icon: Map, gradient: "from-purple-500 to-purple-600" },
    { label: "Analizza i miei progressi negli esercizi", icon: BarChart3, gradient: "from-green-500 to-green-600" },
  ];

  const universityOverviewActions = [
    { label: "Quale lezione dovrei studiare oggi?", icon: BookOpen, gradient: "from-cyan-500 to-cyan-600" },
    { label: "Mostrami il mio percorso di studi", icon: Map, gradient: "from-blue-500 to-blue-600" },
    { label: "Come prepararmi per gli esami?", icon: GraduationCap, gradient: "from-purple-500 to-purple-600" },
    { label: "Analizza i miei progressi universitari", icon: BarChart3, gradient: "from-green-500 to-green-600" },
  ];

  const assistanceActions = [
    { label: "Cosa devo fare oggi?", icon: CheckSquare, gradient: "from-blue-500 to-blue-600" },
    { label: "Quali esercizi ho pendenti?", icon: BookOpen, gradient: "from-green-500 to-green-600" },
    { label: "Come funziona l'università?", icon: CalendarDays, gradient: "from-purple-500 to-purple-600" },
    { label: "Mi puoi fornire una panoramica completa della mia situazione chi sono, cosa faccio e cosa sto cercando di realizzare in modo da creare un identikit chiaro e a 360° di me e della mia attività?", icon: Target, gradient: "from-orange-500 to-orange-600" },
  ];

  const financialConsultantActions = [
    { label: "Crea un piano di risparmio", icon: DollarSign, gradient: "from-green-500 to-green-600" },
    { label: "Analizza la mia situazione finanziaria", icon: Target, gradient: "from-blue-500 to-blue-600" },
    { label: "Suggerisci strategie di investimento", icon: TrendingUp, gradient: "from-purple-500 to-purple-600" },
    { label: "Ottimizza le mie spese", icon: FileText, gradient: "from-orange-500 to-orange-600" },
  ];

  const businessConsultantActions = [
    { label: "Valida la mia idea di business", icon: Lightbulb, gradient: "from-yellow-500 to-yellow-600" },
    { label: "Crea un business plan", icon: FileText, gradient: "from-blue-500 to-blue-600" },
    { label: "Analizza il mercato target", icon: Users, gradient: "from-purple-500 to-purple-600" },
    { label: "Strategie di crescita", icon: TrendingUp, gradient: "from-green-500 to-green-600" },
  ];

  const salesConsultantActions = [
    { label: "Crea uno script di vendita", icon: FileText, gradient: "from-blue-500 to-blue-600" },
    { label: "Analizza il processo di vendita", icon: Target, gradient: "from-purple-500 to-purple-600" },
    { label: "Tecniche di chiusura", icon: TrendingUp, gradient: "from-green-500 to-green-600" },
    { label: "Aumenta le conversioni", icon: Users, gradient: "from-orange-500 to-orange-600" },
  ];

  let actions = assistanceActions;

  if (mode === "assistenza") {
    if (pageContext?.pageType === "library_document" || pageContext?.pageType === "university_lesson") {
      actions = lessonActions;
    } else if (pageContext?.pageType === "exercise") {
      actions = exerciseActions;
    } else if (pageContext?.pageType === "exercises_list") {
      actions = exercisesListActions;
    } else if (pageContext?.pageType === "course") {
      actions = universityOverviewActions;
    }
  } else if (mode === "consulente") {
    if (consultantType === "finanziario") {
      actions = financialConsultantActions;
    } else if (consultantType === "business") {
      actions = businessConsultantActions;
    } else if (consultantType === "vendita") {
      actions = salesConsultantActions;
    }
  }

  return (
    <div className="w-full space-y-2">
      {actions.map((action) => (
        <Button
          key={action.label}
          variant="outline"
          onClick={() => onAction(action.label)}
          disabled={disabled}
          className="w-full justify-start text-left h-auto py-2.5 px-3 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group rounded-lg"
        >
          <div className={`h-8 w-8 rounded-lg bg-gradient-to-br ${action.gradient} flex items-center justify-center mr-3 flex-shrink-0 group-hover:scale-110 transition-transform duration-200`}>
            <action.icon className="h-4 w-4 text-white" />
          </div>
          <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">
            {action.label === "Mi puoi fornire una panoramica completa della mia situazione chi sono, cosa faccio e cosa sto cercando di realizzare in modo da creare un identikit chiaro e a 360° di me e della mia attività?" 
              ? "Panoramica completa a 360°" 
              : action.label}
          </span>
        </Button>
      ))}
    </div>
  );
}