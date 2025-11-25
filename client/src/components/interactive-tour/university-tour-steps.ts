import { DriveStep } from 'driver.js';

export const universityTourSteps: DriveStep[] = [
  // Welcome
  {
    element: 'body',
    popover: {
      title: '🎓 Benvenuto all\'Università!',
      description: 'Ti mostro rapidamente come funziona il tuo percorso formativo. Pronto?',
      side: 'top',
      align: 'center',
    }
  },

  // Statistics Header
  {
    element: '[data-tour="university-stats"]',
    popover: {
      title: '📊 Le Tue Statistiche',
      description: 'Qui vedi a colpo d\'occhio il tuo progresso: lezioni totali, completamento, media voti e attestati ottenuti.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Tab Percorso
  {
    element: '[data-tour="university-tab-percorso"]',
    popover: {
      title: '🗺️ Il Mio Percorso',
      description: 'La sezione principale dove trovi tutta la struttura del corso: anni, trimestri, moduli e lezioni.',
      side: 'bottom',
      align: 'start',
    }
  },

  // Year Card
  {
    element: '[data-tour="university-year-card"]',
    popover: {
      title: '📅 Anno Accademico',
      description: 'Ogni anno è organizzato in trimestri. Clicca per espandere e vedere i contenuti. La barra laterale mostra il tuo progresso.',
      side: 'left',
      align: 'start',
    }
  },

  // Trimester
  {
    element: '[data-tour="university-trimester"]',
    popover: {
      title: '📚 Trimestre',
      description: 'Ogni trimestre contiene moduli tematici. Espandi per vedere le lezioni e i materiali didattici.',
      side: 'left',
      align: 'start',
    }
  },

  // Module
  {
    element: '[data-tour="university-module"]',
    popover: {
      title: '📖 Modulo Didattico',
      description: 'Ogni modulo raggruppa lezioni correlate. Espandi per vedere l\'elenco completo delle lezioni.',
      side: 'left',
      align: 'start',
    }
  },

  // Lesson
  {
    element: '[data-tour="university-lesson"]',
    popover: {
      title: '✅ Lezione',
      description: 'Ogni lezione può avere: materiali da studiare, esercizi collegati, e checkbox per tracciare il completamento.',
      side: 'left',
      align: 'center',
    }
  },

  // Notes Button
  {
    element: '[data-tour="university-lesson-notes-button"]',
    popover: {
      title: '📝 Note Personali',
      description: 'Clicca qui per aggiungere note personali alla lezione. Le tue note vengono salvate automaticamente!',
      side: 'left',
      align: 'center',
    }
  },

  // Tab Esami
  {
    element: '[data-tour="university-tab-esami"]',
    popover: {
      title: '📋 Esami da Fare',
      description: 'Qui trovi tutti gli esami assegnati dal tuo consulente, con date, tempo limite e punteggi.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Tab Attestati
  {
    element: '[data-tour="university-tab-attestati"]',
    popover: {
      title: '🏆 I Miei Attestati',
      description: 'I certificati che hai ottenuto completando trimestri e anni. Puoi scaricarli in formato PDF!',
      side: 'bottom',
      align: 'end',
    }
  },

  // Closing
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come navigare la tua Università! Inizia dal primo anno e buon apprendimento! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
