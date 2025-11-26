import { DriveStep } from 'driver.js';

export const clientTourSteps: DriveStep[] = [
  // GRUPPO 1: Welcome (2 step)
  {
    element: 'body',
    popover: {
      title: '👋 Benvenuto su Consulente Pro!',
      description: 'Ti mostro come usare la piattaforma in soli 2 minuti. Pronto?',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="client-sidebar"]',
    popover: {
      title: '🧭 Barra di Navigazione',
      description: 'Questa è la tua barra di navigazione principale. Da qui puoi accedere a tutte le sezioni della piattaforma.',
      side: 'right',
      align: 'start',
    }
  },

  // GRUPPO 2: Dashboard (1 step)
  {
    element: '[data-tour="client-dashboard"]',
    popover: {
      title: '📊 Dashboard',
      description: 'La tua panoramica completa: esercizi da completare, progressi universitari, prossime consulenze e statistiche personali.',
      side: 'right',
      align: 'start',
    }
  },

  // GRUPPO 3: AI Assistant (1 step)
  {
    element: '[data-tour="client-ai-assistant"]',
    popover: {
      title: '🤖 AI Assistant',
      description: 'Il tuo consulente virtuale sempre disponibile. Puoi fargli domande sul tuo percorso, chiedere consigli e ricevere supporto 24/7.',
      side: 'right',
      align: 'start',
    }
  },

  // GRUPPO 4: La Mia Università (7 step)
  {
    element: '[data-tour="client-la-mia-universita"]',
    popover: {
      title: '🎓 La Mia Università',
      description: 'Il cuore della tua formazione. Clicco per mostrarti cosa contiene...',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-la-mia-universita-submenu"]',
    popover: {
      title: '📚 Sezioni Università',
      description: 'Qui trovi tutte le risorse formative organizzate per te.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-universita"]',
    popover: {
      title: '🏛️ Università',
      description: 'Il percorso formativo completo organizzato in anni, trimestri e moduli. Qui vedi la struttura di tutto il tuo percorso.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-i-miei-esercizi"]',
    popover: {
      title: '📝 I Miei Esercizi',
      description: 'Gli esercizi pratici assegnati dal tuo consulente. Vedi qui quanti ne hai da completare (il badge mostra il numero).',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-corsi"]',
    popover: {
      title: '📖 Corsi',
      description: 'Materiali di studio, risorse e contenuti formativi a tua disposizione.',
      side: 'right',
      align: 'start',
    }
  },

  // GRUPPO 5: Il Mio Tempo (6 step)
  {
    element: '[data-tour="client-il-mio-tempo"]',
    popover: {
      title: '⏰ Il Mio Tempo',
      description: 'Gestisci calendario, produttività e attività quotidiane.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-il-mio-tempo-submenu"]',
    popover: {
      title: '📅 Sezioni Tempo',
      description: 'Tutto per organizzare il tuo tempo in modo efficace.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-calendario"]',
    popover: {
      title: '📆 Calendario',
      description: 'Visualizza tutti i tuoi eventi, appuntamenti e scadenze in un unico posto.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-task-riflessioni"]',
    popover: {
      title: '✅ Task & Riflessioni',
      description: 'Traccia le tue attività quotidiane e scrivi riflessioni sul tuo percorso.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-momentum"]',
    popover: {
      title: '⚡ Momentum',
      description: 'Monitora la tua costanza e produttività. Mantieni il tuo streak attivo!',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-submenu-consulenze"]',
    popover: {
      title: '🗓️ Consulenze',
      description: 'Le tue sessioni di consulenza programmate con il consulente.',
      side: 'right',
      align: 'start',
    }
  },

  // GRUPPO 6: Extras (2 step)
  {
    element: '[data-testid="link-gestione-finanziaria"]',
    popover: {
      title: '💰 Gestione Finanziaria',
      description: 'Link diretto al software esterno per la gestione finanziaria. Si apre in una nuova scheda.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="client-user-settings"]',
    popover: {
      title: '⚙️ Impostazioni',
      description: 'Accedi alle tue impostazioni personali, modifica il profilo e configura le tue preferenze.',
      side: 'left',
      align: 'end',
    }
  },

  // GRUPPO 7: Chiusura (3 step)
  {
    element: '[data-tour="client-collapse-button"]',
    popover: {
      title: '👈 Nascondi Sidebar',
      description: 'Puoi nascondere la barra laterale per avere più spazio. Usa anche la scorciatoia Ctrl+B (o Cmd+B su Mac).',
      side: 'right',
      align: 'center',
    }
  },
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come navigare Consulente Pro! Se hai bisogno di rivedere il tour, clicca su "Guida Interattiva" nella barra superiore.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: 'body',
    popover: {
      title: '💡 Un ultimo consiglio',
      description: 'Esplora ogni sezione con calma. Il tuo consulente è qui per supportarti in ogni fase del percorso. Buon lavoro! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
