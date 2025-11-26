import { DriveStep } from 'driver.js';

export const dailyTasksTourSteps: DriveStep[] = [
  {
    element: 'body',
    popover: {
      title: '✅ Benvenuto ai Task & Riflessioni!',
      description: 'Ti mostro come organizzare i tuoi task giornalieri e tenere traccia delle tue riflessioni. Pronto?',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="tasks-calendar-view"]',
    popover: {
      title: '📅 Calendario Settimanale',
      description: 'Visualizza i tuoi task organizzati per settimana. Ogni giorno mostra i task da completare e quelli già completati.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="tasks-week-navigation"]',
    popover: {
      title: '◀️ ▶️ Navigazione Settimanale',
      description: 'Naviga tra le settimane per vedere i task passati o pianificare quelli futuri. Il bottone "Oggi" ti riporta alla settimana corrente.',
      side: 'bottom',
      align: 'center',
    }
  },
  {
    element: '[data-tour="tasks-add-new"]',
    popover: {
      title: '➕ Aggiungi Task',
      description: 'Clicca qui per aggiungere un nuovo task per qualsiasi giorno della settimana. Puoi anche cliccare direttamente sul giorno.',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="tasks-day-card"]',
    popover: {
      title: '📋 Card Giornaliera',
      description: 'Ogni giorno ha la sua card che mostra: la data, i task da completare, quelli completati e la barra di progresso.',
      side: 'top',
      align: 'start',
    }
  },
  {
    element: '[data-tour="tasks-task-item"]',
    popover: {
      title: '✏️ Task Individuale',
      description: 'Clicca sulla checkbox per completare un task. Usa i pulsanti per modificare o eliminare. I task completati vengono barrati.',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="tasks-progress-bar"]',
    popover: {
      title: '📊 Progresso Settimanale',
      description: 'Vedi a colpo d\'occhio quanti task hai completato questa settimana. La percentuale ti motiva a completare tutto!',
      side: 'bottom',
      align: 'center',
    }
  },
  {
    element: '[data-tour="reflections-section"]',
    popover: {
      title: '💭 Riflessioni Giornaliere',
      description: 'Le riflessioni ti aiutano a tracciare cosa hai imparato, cosa è andato bene e cosa migliorare. Essenziale per la crescita!',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="reflections-form"]',
    popover: {
      title: '📝 Form Riflessione',
      description: 'Compila la riflessione giornaliera: cosa è andato bene, cosa migliorare, obiettivi per domani. Include anche un rating della giornata!',
      side: 'left',
      align: 'start',
    }
  },
  {
    element: '[data-tour="reflections-history"]',
    popover: {
      title: '📚 Storico Riflessioni',
      description: 'Rivedi le tue riflessioni passate per vedere i tuoi progressi nel tempo. Puoi filtrare per data e vedere i pattern.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come gestire i tuoi task giornalieri e le riflessioni! Usa questi strumenti ogni giorno per massimizzare la produttività! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
