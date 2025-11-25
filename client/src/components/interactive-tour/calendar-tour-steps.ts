import { DriveStep } from 'driver.js';

export const calendarTourSteps: DriveStep[] = [
  // Welcome
  {
    element: 'body',
    popover: {
      title: '📅 Benvenuto al Calendario!',
      description: 'Ti mostro come usare il calendario e il sistema Momentum per organizzare la tua giornata e tracciare i tuoi progressi. Pronto?',
      side: 'top',
      align: 'center',
    }
  },

  // Tab Navigation
  {
    element: '[data-tour="calendar-tab-agenda"]',
    popover: {
      title: '📆 Tab Agenda',
      description: 'Qui visualizzi il tuo calendario mensile con tutti gli eventi, consulenze e scadenze. Clicca per vedere la vista calendario completa.',
      side: 'bottom',
      align: 'start',
    }
  },
  {
    element: '[data-tour="calendar-tab-momentum"]',
    popover: {
      title: '⚡ Tab Momentum',
      description: 'Il sistema Momentum ti aiuta a tracciare i tuoi progressi giornalieri, check-in, obiettivi e produttività. Un vero game-changer!',
      side: 'bottom',
      align: 'start',
    }
  },

  // Calendar View (Agenda Tab)
  {
    element: '[data-tour="calendar-view"]',
    popover: {
      title: '🗓️ Vista Calendario',
      description: 'Il calendario mostra tutti i tuoi eventi. Clicca su una data per creare un nuovo evento, oppure clicca su un evento esistente per modificarlo.',
      side: 'top',
      align: 'center',
    }
  },

  {
    element: '[data-tour="calendar-new-event-btn"]',
    popover: {
      title: '➕ Nuovo Evento',
      description: 'Clicca qui per aggiungere rapidamente un nuovo evento al tuo calendario. Puoi impostare titolo, descrizione, data, ora e colore personalizzato.',
      side: 'left',
      align: 'center',
    }
  },

  {
    element: '[data-tour="calendar-navigation"]',
    popover: {
      title: '◀️ ▶️ Navigazione Calendario',
      description: 'Usa questi pulsanti per navigare tra i mesi. Puoi anche cliccare sul mese corrente per tornare rapidamente a oggi.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Switch to Momentum tab for remaining steps
  {
    element: '[data-tour="calendar-tab-momentum"]',
    popover: {
      title: '🚀 Passiamo a Momentum',
      description: 'Ora scopriamo il sistema Momentum! Clicco automaticamente per mostrarti questa potente funzionalità...',
      side: 'bottom',
      align: 'start',
    }
  },

  // Momentum Dashboard
  {
    element: '[data-tour="momentum-dashboard"]',
    popover: {
      title: '📊 Dashboard Momentum',
      description: 'La dashboard mostra a colpo d\'occhio: il tuo streak di giorni consecutivi, i check-in di oggi, il punteggio produttività e gli obiettivi attivi.',
      side: 'top',
      align: 'center',
    }
  },

  {
    element: '[data-tour="momentum-streak"]',
    popover: {
      title: '🔥 Streak Giornaliero',
      description: 'Il tuo streak conta quanti giorni consecutivi hai completato almeno un check-in. Mantieni vivo il tuo streak per massimizzare la produttività!',
      side: 'left',
      align: 'center',
    }
  },

  {
    element: '[data-tour="momentum-checkin-btn"]',
    popover: {
      title: '✅ Check-in Rapido',
      description: 'Fai check-in durante la giornata per tracciare cosa stai facendo. Più check-in fai, più alto sarà il tuo punteggio produttività!',
      side: 'left',
      align: 'center',
    }
  },

  {
    element: '[data-tour="momentum-productivity-score"]',
    popover: {
      title: '📈 Punteggio Produttività',
      description: 'Il punteggio viene calcolato in base a: numero di check-in, task completati, obiettivi raggiunti e consistenza del tuo streak.',
      side: 'left',
      align: 'center',
    }
  },

  {
    element: '[data-tour="momentum-active-goals"]',
    popover: {
      title: '🎯 Obiettivi Attivi',
      description: 'Visualizza i tuoi obiettivi in corso con barre di progresso in tempo reale. Clicca per vedere i dettagli o per gestire gli obiettivi.',
      side: 'top',
      align: 'center',
    }
  },

  {
    element: '[data-tour="momentum-goals-btn"]',
    popover: {
      title: '🎯 Gestione Obiettivi',
      description: 'Clicca qui per creare nuovi obiettivi, monitorare i progressi e celebrare i traguardi raggiunti. Gli obiettivi ti aiutano a rimanere focalizzato!',
      side: 'bottom',
      align: 'center',
    }
  },

  {
    element: '[data-tour="momentum-settings-btn"]',
    popover: {
      title: '⚙️ Impostazioni Momentum',
      description: 'Personalizza le notifiche dei check-in, imposta gli orari preferiti, configura i reminder automatici e molto altro.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Final step
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come usare il Calendario e il sistema Momentum! Inizia a tracciare i tuoi progressi, fai check-in regolari e raggiungi i tuoi obiettivi! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
