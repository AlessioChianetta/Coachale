import { ConsultantPageType, ConsultantPageContext } from "@/hooks/use-consultant-page-context";

export interface QuickAction {
  label: string;
  message: string;
  icon?: string;
}

/**
 * Registro delle quick actions specifiche per ogni tipo di pagina consulente
 * Fornisce suggerimenti contestuali basati sulla pagina corrente
 */
export const consultantQuickActionsRegistry: Record<ConsultantPageType, (context: ConsultantPageContext) => QuickAction[]> = {
  whatsapp_config: (context) => [
    {
      label: "📱 Configurazione WhatsApp",
      message: "Come configuro WhatsApp Business per la mia piattaforma?",
      icon: "Settings"
    },
    {
      label: "💬 Template WhatsApp",
      message: "Come creo e gestisco i template WhatsApp?",
      icon: "MessageSquare"
    },
    {
      label: "🔗 Credenziali Twilio",
      message: "Aiutami a configurare le credenziali Twilio",
      icon: "Key"
    },
    {
      label: "📊 Conversazioni attive",
      message: context.additionalContext?.activeConversations 
        ? `Mostrami dettagli sulle ${context.additionalContext.activeConversations} conversazioni attive`
        : "Mostrami le conversazioni attive",
      icon: "Users"
    }
  ],

  whatsapp_conversations: (context) => [
    {
      label: "💬 Conversazioni recenti",
      message: "Mostrami le conversazioni WhatsApp più recenti",
      icon: "MessageCircle"
    },
    {
      label: "⏰ Lead da contattare",
      message: "Quali lead devo contattare oggi?",
      icon: "Clock"
    },
    {
      label: "🎯 Status lead",
      message: "Mostrami lo stato dei miei lead (caldo, tiepido, freddo)",
      icon: "Target"
    },
    {
      label: "✅ Appuntamenti prenotati",
      message: "Quanti appuntamenti sono stati prenotati via WhatsApp?",
      icon: "Calendar"
    }
  ],

  whatsapp_templates: (context) => [
    {
      label: "📝 Creare template",
      message: "Come creo un nuovo template WhatsApp?",
      icon: "FilePlus"
    },
    {
      label: "🔧 Variabili template",
      message: "Come uso le variabili nei template WhatsApp?",
      icon: "Code"
    },
    {
      label: "📋 Template esistenti",
      message: "Mostrami tutti i miei template WhatsApp",
      icon: "List"
    },
    {
      label: "✨ Best practices",
      message: "Quali sono le best practices per i template WhatsApp?",
      icon: "Lightbulb"
    }
  ],

  calendar_settings: (context) => [
    {
      label: "⚙️ Configurazione calendario",
      message: "Come configuro la mia disponibilità sul calendario?",
      icon: "Settings"
    },
    {
      label: "🕐 Slot disponibilità",
      message: "Come imposto gli slot orari per gli appuntamenti?",
      icon: "Clock"
    },
    {
      label: "🔔 Notifiche",
      message: "Come gestisco le notifiche per gli appuntamenti?",
      icon: "Bell"
    },
    {
      label: "🌍 Fuso orario",
      message: "Come imposto il fuso orario corretto?",
      icon: "Globe"
    }
  ],

  calendar: (context) => [
    {
      label: "📅 Oggi",
      message: context.additionalContext?.todayAppointments
        ? `Mostrami i ${context.additionalContext.todayAppointments} appuntamenti di oggi`
        : "Quali appuntamenti ho oggi?",
      icon: "Calendar"
    },
    {
      label: "📆 Prossimi appuntamenti",
      message: context.additionalContext?.upcomingAppointments
        ? `Mostrami i prossimi ${context.additionalContext.upcomingAppointments} appuntamenti`
        : "Quali sono i miei prossimi appuntamenti?",
      icon: "CalendarDays"
    },
    {
      label: "➕ Nuovo appuntamento",
      message: "Come creo un nuovo appuntamento?",
      icon: "Plus"
    },
    {
      label: "🔄 Riprogrammare",
      message: "Come riprogrammo un appuntamento?",
      icon: "RefreshCw"
    }
  ],

  clients_management: (context) => [
    {
      label: "👥 Portfolio clienti",
      message: context.additionalContext?.totalClients
        ? `Mostrami una panoramica dei miei ${context.additionalContext.totalClients} clienti`
        : "Mostrami una panoramica dei miei clienti",
      icon: "Users"
    },
    {
      label: "⚠️ Clienti indietro",
      message: "Quali clienti sono indietro con gli esercizi?",
      icon: "AlertTriangle"
    },
    {
      label: "✅ Clienti attivi",
      message: context.additionalContext?.activeClients
        ? `Mostrami i ${context.additionalContext.activeClients} clienti attivi`
        : "Mostrami i clienti attivi",
      icon: "CheckCircle"
    },
    {
      label: "📈 Progressi",
      message: "Mostrami i progressi dei miei clienti",
      icon: "TrendingUp"
    }
  ],

  client_specific: (context) => [
    {
      label: "📊 Stato cliente",
      message: context.additionalContext?.clientName
        ? `Come sta andando ${context.additionalContext.clientName}?`
        : "Come sta andando questo cliente?",
      icon: "User"
    },
    {
      label: "💪 Esercizi",
      message: "Quali esercizi ha completato questo cliente?",
      icon: "Dumbbell"
    },
    {
      label: "📅 Consulenze",
      message: "Mostrami le consulenze con questo cliente",
      icon: "Calendar"
    },
    {
      label: "🎯 Obiettivi",
      message: "Quali sono gli obiettivi attivi per questo cliente?",
      icon: "Target"
    }
  ],

  campaigns: (context) => [
    {
      label: "📊 Campagne attive",
      message: context.additionalContext?.activeCampaigns
        ? `Mostrami le ${context.additionalContext.activeCampaigns} campagne attive`
        : "Mostrami le campagne attive",
      icon: "BarChart"
    },
    {
      label: "➕ Nuova campagna",
      message: "Come creo una nuova campagna marketing?",
      icon: "Plus"
    },
    {
      label: "📈 Performance",
      message: "Come stanno performando le mie campagne?",
      icon: "TrendingUp"
    },
    {
      label: "🎯 Conversion rate",
      message: "Qual è il conversion rate delle campagne?",
      icon: "Target"
    }
  ],

  email_journey: (context) => [
    {
      label: "📧 Journey email",
      message: "Come funziona il sistema di email journey?",
      icon: "Mail"
    },
    {
      label: "📅 Template giornalieri",
      message: "Come creo template per i giorni specifici del journey?",
      icon: "Calendar"
    },
    {
      label: "✨ AI Generator",
      message: "Come uso l'AI per generare email personalizzate?",
      icon: "Sparkles"
    },
    {
      label: "📊 Analytics",
      message: "Mostrami le statistiche delle email inviate",
      icon: "BarChart"
    }
  ],

  email_logs: (context) => [
    {
      label: "📬 Email inviate",
      message: "Mostrami le ultime email inviate",
      icon: "Send"
    },
    {
      label: "⏰ Scheduler",
      message: "Come funziona lo scheduler automatico delle email?",
      icon: "Clock"
    },
    {
      label: "✅ Email consegnate",
      message: "Quante email sono state consegnate con successo?",
      icon: "CheckCircle"
    },
    {
      label: "❌ Errori",
      message: "Ci sono errori nell'invio delle email?",
      icon: "AlertCircle"
    }
  ],

  smtp_settings: (context) => [
    {
      label: "⚙️ Configurazione SMTP",
      message: "Come configuro il server SMTP?",
      icon: "Settings"
    },
    {
      label: "🔐 Credenziali",
      message: "Come inserisco le credenziali SMTP in modo sicuro?",
      icon: "Key"
    },
    {
      label: "✅ Test configurazione",
      message: "Come testo se la configurazione SMTP funziona?",
      icon: "TestTube"
    },
    {
      label: "📧 Email mittente",
      message: "Come imposto l'email e il nome del mittente?",
      icon: "Mail"
    }
  ],

  api_settings: (context) => [
    {
      label: "🔌 API esterne",
      message: "Come configuro le API esterne?",
      icon: "Plug"
    },
    {
      label: "📥 Import lead",
      message: "Come importo lead da API esterne?",
      icon: "Download"
    },
    {
      label: "🔄 Polling automatico",
      message: "Come funziona il polling automatico delle API?",
      icon: "RefreshCw"
    },
    {
      label: "📊 Log import",
      message: "Mostrami i log degli ultimi import",
      icon: "FileText"
    }
  ],

  exercises_management: (context) => [
    {
      label: "📝 Esercizi da revisionare",
      message: "Quanti esercizi devo revisionare?",
      icon: "FileCheck"
    },
    {
      label: "➕ Crea esercizio",
      message: "Come creo un nuovo esercizio per i miei clienti?",
      icon: "Plus"
    },
    {
      label: "📊 Statistiche",
      message: "Mostrami le statistiche degli esercizi assegnati",
      icon: "BarChart"
    },
    {
      label: "✅ Completati",
      message: "Quanti esercizi sono stati completati questa settimana?",
      icon: "CheckCircle"
    }
  ],

  exercise_templates: (context) => [
    {
      label: "📋 Template disponibili",
      message: "Mostrami tutti i template di esercizi disponibili",
      icon: "List"
    },
    {
      label: "➕ Nuovo template",
      message: "Come creo un nuovo template di esercizio?",
      icon: "Plus"
    },
    {
      label: "🔄 Riutilizzare template",
      message: "Come riutilizzo un template esistente?",
      icon: "Copy"
    },
    {
      label: "📊 Template più usati",
      message: "Quali sono i template più utilizzati?",
      icon: "TrendingUp"
    }
  ],

  library: (context) => [
    {
      label: "📚 Biblioteca documenti",
      message: "Come organizzo i documenti nella biblioteca?",
      icon: "BookOpen"
    },
    {
      label: "➕ Carica documento",
      message: "Come carico un nuovo documento?",
      icon: "Upload"
    },
    {
      label: "🏷️ Categorie",
      message: "Come gestisco le categorie dei documenti?",
      icon: "Tags"
    },
    {
      label: "🔍 Cerca documenti",
      message: "Come cerco documenti specifici?",
      icon: "Search"
    }
  ],

  university: (context) => [
    {
      label: "🎓 Università",
      message: "Come funziona il sistema Università?",
      icon: "GraduationCap"
    },
    {
      label: "📚 Moduli e lezioni",
      message: "Come creo moduli e lezioni?",
      icon: "BookOpen"
    },
    {
      label: "👥 Assegnazioni",
      message: "Come assegno anni universitari ai clienti?",
      icon: "Users"
    },
    {
      label: "📊 Progressi studenti",
      message: "Mostrami i progressi degli studenti",
      icon: "TrendingUp"
    }
  ],

  tasks: (context) => [
    {
      label: "✅ Task pendenti",
      message: "Quali task ho in sospeso?",
      icon: "CheckSquare"
    },
    {
      label: "📅 Task oggi",
      message: "Quali task devo completare oggi?",
      icon: "Calendar"
    },
    {
      label: "➕ Nuovo task",
      message: "Come creo un nuovo task?",
      icon: "Plus"
    },
    {
      label: "🎯 Priorità",
      message: "Quali sono i task ad alta priorità?",
      icon: "AlertCircle"
    }
  ],

  consultations: (context) => [
    {
      label: "📅 Consulenze oggi",
      message: "Quali consulenze ho oggi?",
      icon: "Calendar"
    },
    {
      label: "📊 Consulenze completate",
      message: "Mostrami le consulenze completate",
      icon: "CheckCircle"
    },
    {
      label: "➕ Nuova consulenza",
      message: "Come programmo una nuova consulenza?",
      icon: "Plus"
    },
    {
      label: "📝 Task consulenza",
      message: "Come gestisco i task collegati alle consulenze?",
      icon: "ListChecks"
    }
  ],

  ai_agents: (context) => [
    {
      label: "🤖 Agenti AI",
      message: "Come funzionano gli agenti AI (DOT, Millie, Echo, Spec)?",
      icon: "Bot"
    },
    {
      label: "📊 Performance agenti",
      message: "Come stanno performando i miei agenti AI?",
      icon: "BarChart"
    },
    {
      label: "⚙️ Configurazione",
      message: "Come configuro il comportamento degli agenti AI?",
      icon: "Settings"
    },
    {
      label: "📈 Metriche",
      message: "Mostrami le metriche degli agenti AI",
      icon: "TrendingUp"
    }
  ],

  ai_settings: (context) => [
    {
      label: "⚙️ Impostazioni AI",
      message: "Come configuro le impostazioni dell'AI Assistant?",
      icon: "Settings"
    },
    {
      label: "🎯 Personalizzazione",
      message: "Come personalizzo le risposte dell'AI?",
      icon: "Target"
    },
    {
      label: "🔑 API Keys",
      message: "Come gestisco le API keys per l'AI?",
      icon: "Key"
    },
    {
      label: "📊 Utilizzo",
      message: "Quante richieste AI ho fatto questo mese?",
      icon: "BarChart"
    }
  ],

  dashboard: (context) => [
    {
      label: "📊 Overview",
      message: "Mostrami una panoramica generale della mia attività",
      icon: "LayoutDashboard"
    },
    {
      label: "👥 Clienti attivi",
      message: "Quanti clienti attivi ho?",
      icon: "Users"
    },
    {
      label: "⏰ Oggi",
      message: "Cosa devo fare oggi?",
      icon: "Clock"
    },
    {
      label: "📈 Performance",
      message: "Come sto performando questo mese?",
      icon: "TrendingUp"
    }
  ],

  other: () => [
    {
      label: "💡 Aiuto generale",
      message: "Come posso aiutarti con la piattaforma?",
      icon: "HelpCircle"
    },
    {
      label: "🚀 Iniziare",
      message: "Da dove inizio per gestire i miei clienti?",
      icon: "Rocket"
    },
    {
      label: "📚 Guida",
      message: "Mostrami una guida delle funzionalità principali",
      icon: "BookOpen"
    },
    {
      label: "⚡ Best practices",
      message: "Quali sono le best practices per usare la piattaforma?",
      icon: "Zap"
    }
  ]
};

/**
 * Ottiene le quick actions per una specifica pagina consulente
 */
export function getConsultantQuickActions(context: ConsultantPageContext): QuickAction[] {
  const actionGenerator = consultantQuickActionsRegistry[context.pageType];
  if (!actionGenerator) {
    return consultantQuickActionsRegistry.other(context);
  }
  return actionGenerator(context);
}
