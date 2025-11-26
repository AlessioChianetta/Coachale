import { motion, AnimatePresence } from "framer-motion";
import { X, Settings, MessageSquare, Calendar, Users, BarChart, Mail, Plug, FileText, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConsultantPageContext } from "@/hooks/use-consultant-page-context";

interface ConsultantContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext: ConsultantPageContext;
  onOpenMainAI: () => void;
}

export function ConsultantContextPanel({ isOpen, onClose, pageContext, onOpenMainAI }: ConsultantContextPanelProps) {
  const getPageIcon = () => {
    switch (pageContext.pageType) {
      case "whatsapp_config":
      case "whatsapp_conversations":
      case "whatsapp_templates":
        return MessageSquare;
      case "calendar_settings":
      case "calendar":
        return Calendar;
      case "clients_management":
      case "client_specific":
        return Users;
      case "campaigns":
      case "email_journey":
      case "email_logs":
        return BarChart;
      case "smtp_settings":
        return Mail;
      case "api_settings":
        return Plug;
      default:
        return Settings;
    }
  };

  const getPageTitle = () => {
    switch (pageContext.pageType) {
      case "whatsapp_config":
        return "Configurazione WhatsApp";
      case "whatsapp_conversations":
        return "Conversazioni WhatsApp";
      case "whatsapp_templates":
        return "Template WhatsApp";
      case "calendar_settings":
        return "Impostazioni Calendario";
      case "calendar":
        return "Calendario";
      case "clients_management":
        return "Gestione Clienti";
      case "client_specific":
        return "Cliente Specifico";
      case "campaigns":
        return "Campagne Marketing";
      case "email_journey":
        return "Email Journey";
      case "email_logs":
        return "Log Email";
      case "smtp_settings":
        return "Configurazione SMTP";
      case "api_settings":
        return "Impostazioni API";
      case "exercises_management":
        return "Gestione Esercizi";
      case "exercise_templates":
        return "Template Esercizi";
      default:
        return "Pagina";
    }
  };

  const getPageEmoji = () => {
    switch (pageContext.pageType) {
      case "whatsapp_config":
      case "whatsapp_conversations":
      case "whatsapp_templates":
        return "📱";
      case "calendar_settings":
      case "calendar":
        return "📅";
      case "clients_management":
      case "client_specific":
        return "👥";
      case "campaigns":
        return "📊";
      case "email_journey":
      case "email_logs":
        return "📧";
      case "smtp_settings":
        return "⚙️";
      case "api_settings":
        return "🔌";
      case "exercises_management":
        return "📝";
      default:
        return "💼";
    }
  };

  const getHelpPoints = () => {
    switch (pageContext.pageType) {
      case "whatsapp_config":
        return [
          "Configurare le credenziali Twilio",
          "Creare e gestire template",
          "Visualizzare conversazioni attive",
          "Best practices WhatsApp Business"
        ];
      case "calendar_settings":
        return [
          "Impostare la disponibilità",
          "Configurare slot orari",
          "Gestire notifiche",
          "Fuso orario e preferenze"
        ];
      case "clients_management":
        return [
          "Panoramica portfolio clienti",
          "Identificare clienti indietro",
          "Analizzare progressi",
          "Gestire assegnazioni"
        ];
      case "campaigns":
        return [
          "Creare nuove campagne",
          "Analizzare performance",
          "Monitorare conversion rate",
          "Ottimizzare strategia"
        ];
      case "api_settings":
        return [
          "Configurare API esterne",
          "Importare lead automaticamente",
          "Gestire polling",
          "Visualizzare log import"
        ];
      default:
        return [
          "Navigare nella sezione",
          "Ottimizzare il workflow",
          "Analizzare dati",
          "Best practices"
        ];
    }
  };

  const PageIcon = getPageIcon();
  const gradientClass = "from-indigo-500 to-purple-600";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -400 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -400 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-6 left-6 z-40 w-[380px]"
        >
          <Card className="w-full shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardHeader className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${gradientClass} flex items-center justify-center`}>
                    <PageIcon className="h-4 w-4 text-white" />
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Contesto Rilevato
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800 h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-purple-200 dark:from-indigo-900/40 dark:to-purple-800/40 flex items-center justify-center`}>
                  <PageIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
              </div>
              
              <Badge variant="outline" className="mb-3 text-xs bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200">
                {getPageEmoji()} {getPageTitle()}
              </Badge>
              
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                Stai lavorando su:
              </h3>
              
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 mb-4 border border-indigo-100 dark:border-indigo-800">
                <p className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm">
                  {getPageTitle()}
                </p>
                {pageContext.additionalContext?.clientName && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                    👤 {pageContext.additionalContext.clientName}
                  </p>
                )}
                {pageContext.additionalContext?.activeConversations !== undefined && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                    💬 {pageContext.additionalContext.activeConversations} conversazioni attive
                  </p>
                )}
                {pageContext.additionalContext?.totalClients !== undefined && (
                  <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-1">
                    👥 {pageContext.additionalContext.totalClients} clienti totali
                  </p>
                )}
              </div>
              
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                L'AI Assistant può aiutarti con:
              </p>
              
              <div className="text-xs space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                {getHelpPoints().map((point, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                    <span className="text-gray-700 dark:text-gray-300">{point}</span>
                  </div>
                ))}
              </div>

              <Button
                onClick={onOpenMainAI}
                className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Apri AI Assistant
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
