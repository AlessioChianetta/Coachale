import { Button } from "@/components/ui/button";
import { ConsultantPageContext } from "@/hooks/use-consultant-page-context";
import { getConsultantQuickActions } from "@/lib/consultant-quick-actions";
import * as Icons from "lucide-react";
import { ArrowRight } from "lucide-react";

interface ConsultantQuickActionsProps {
  pageContext: ConsultantPageContext;
  onAction: (action: string) => void;
  disabled?: boolean;
}

export function ConsultantQuickActions({ pageContext, onAction, disabled = false }: ConsultantQuickActionsProps) {
  const quickActions = getConsultantQuickActions(pageContext);

  // Mappa dei colori gradient per tipo di pagina
  const gradientMap: Record<string, string> = {
    whatsapp_config: "from-green-500 to-green-600",
    whatsapp_conversations: "from-emerald-500 to-emerald-600",
    whatsapp_templates: "from-teal-500 to-teal-600",
    calendar_settings: "from-blue-500 to-blue-600",
    calendar: "from-indigo-500 to-indigo-600",
    clients_management: "from-purple-500 to-purple-600",
    client_specific: "from-violet-500 to-violet-600",
    campaigns: "from-pink-500 to-pink-600",
    email_journey: "from-rose-500 to-rose-600",
    email_logs: "from-red-500 to-red-600",
    smtp_settings: "from-orange-500 to-orange-600",
    api_settings: "from-amber-500 to-amber-600",
    exercises_management: "from-yellow-500 to-yellow-600",
    exercise_templates: "from-lime-500 to-lime-600",
    library: "from-cyan-500 to-cyan-600",
    university: "from-sky-500 to-sky-600",
    tasks: "from-blue-500 to-blue-600",
    consultations: "from-indigo-500 to-indigo-600",
    ai_agents: "from-purple-500 to-purple-600",
    ai_settings: "from-fuchsia-500 to-fuchsia-600",
    dashboard: "from-gray-500 to-gray-600",
    other: "from-slate-500 to-slate-600"
  };

  const gradient = gradientMap[pageContext.pageType] || gradientMap.other;

  return (
    <div className="w-full space-y-2">
      {quickActions.map((action, index) => {
        const IconComponent = action.icon && (Icons as any)[action.icon] 
          ? (Icons as any)[action.icon] 
          : Icons.HelpCircle;

        return (
          <Button
            key={index}
            variant="outline"
            onClick={() => onAction(action.message)}
            disabled={disabled}
            className="w-full justify-between text-left h-auto py-3 px-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 hover:border-violet-400 dark:hover:border-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group rounded-xl shadow-sm hover:shadow-md"
          >
            <div className="flex items-center gap-3">
              <div className={`h-9 w-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform duration-200 shadow-sm`}>
                <IconComponent className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-200 leading-tight">
                {action.label}
              </span>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 group-hover:translate-x-1 transition-all duration-200 flex-shrink-0" />
          </Button>
        );
      })}
    </div>
  );
}
