import { DriveStep } from 'driver.js';

export const exercisesTourSteps: DriveStep[] = [
  // Welcome
  {
    element: 'body',
    popover: {
      title: '👋 Benvenuto in I Miei Esercizi!',
      description: 'Ti mostro rapidamente come funziona questa sezione. Pronto?',
      side: 'top',
      align: 'center',
    }
  },

  // Modalità Consulenza/Corso
  {
    element: '[data-tour="exercises-mode-consulenza"]',
    popover: {
      title: '📋 Modalità Consulenza',
      description: 'Gli esercizi personalizzati assegnati dal tuo consulente. Qui trovi gli esercizi creati appositamente per il tuo percorso.',
      side: 'bottom',
      align: 'center',
    }
  },
  {
    element: '[data-tour="exercises-mode-corso"]',
    popover: {
      title: '📚 Modalità Corso',
      description: 'Gli esercizi del corso (Newsletter e materiali formativi). Puoi passare da una modalità all\'altra con un click.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Filtri per stato
  {
    element: '[data-tour="exercises-filters-status"]',
    popover: {
      title: '🔍 Filtri per Stato',
      description: 'Filtra gli esercizi in base al loro stato: Da Completare, In Corso, In Revisione o Completati.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="exercises-filter-pending"]',
    popover: {
      title: '🎯 Da Completare',
      description: 'Gli esercizi ancora da iniziare. Questi sono gli esercizi prioritari assegnati dal tuo consulente.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="exercises-filter-inprogress"]',
    popover: {
      title: '▶️ In Corso',
      description: 'Gli esercizi che hai già iniziato ma non ancora completato. Continua da dove hai lasciato!',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="exercises-filter-completed"]',
    popover: {
      title: '✅ Completati',
      description: 'Gli esercizi che hai terminato con successo. Qui puoi rivedere il tuo lavoro e il punteggio ricevuto.',
      side: 'right',
      align: 'start',
    }
  },

  // Vista Kanban
  {
    element: '[data-tour="exercises-kanban-pending"]',
    popover: {
      title: '📊 Colonna "Da Completare"',
      description: 'Gli esercizi sono organizzati in colonne per stato. Questa colonna mostra tutti gli esercizi da iniziare.',
      side: 'top',
      align: 'start',
    }
  },
  {
    element: '[data-tour="exercises-card-example"]',
    popover: {
      title: '📝 Card Esercizio',
      description: 'Clicca su qualsiasi card per aprire l\'esercizio. Puoi vedere: titolo, categoria, durata stimata e stato.',
      side: 'left',
      align: 'center',
    }
  },

  // Chiusura
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come gestire i tuoi esercizi! Inizia dagli esercizi "Da Completare" e buon lavoro! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
