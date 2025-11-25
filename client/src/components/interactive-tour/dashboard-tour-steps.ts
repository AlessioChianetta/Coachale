import { DriveStep } from 'driver.js';

export const dashboardTourSteps: DriveStep[] = [
  // Welcome
  {
    element: 'body',
    popover: {
      title: '👋 Benvenuto nella Dashboard!',
      description: 'Ti mostro rapidamente tutte le funzionalità principali della tua Dashboard personale. Pronto?',
      side: 'top',
      align: 'center',
    }
  },

  // Hero Greeting
  {
    element: '[data-tour="dashboard-hero-greeting"]',
    popover: {
      title: '🌟 Il Tuo Saluto Personale',
      description: 'Il saluto cambia in base all\'ora del giorno (Buongiorno, Buon pomeriggio, Buonasera) e ti mostra un messaggio contestuale in base ai tuoi progressi.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Tutorial Card
  {
    element: '[data-tour="dashboard-tutorial-card"]',
    popover: {
      title: '📚 Guida Completa',
      description: 'Qui trovi il tutorial completo con guide dettagliate per ogni funzionalità della piattaforma: Università, Esercizi, AI Assistant, Task e molto altro.',
      side: 'bottom',
      align: 'start',
    }
  },

  // Next Action Card
  {
    element: '[data-tour="dashboard-next-action"]',
    popover: {
      title: '🎯 La Tua Prossima Azione',
      description: 'Questa card ti mostra sempre la tua prossima attività prioritaria: esercizio da completare o task giornaliero. Include la durata stimata e il tuo streak di giorni consecutivi!',
      side: 'bottom',
      align: 'center',
    }
  },

  // Momentum Widget (if present)
  {
    element: '[data-tour="dashboard-momentum-widget"]',
    popover: {
      title: '🔥 Momentum Widget',
      description: 'Monitora il tuo streak giornaliero, i check-in di oggi e il punteggio di produttività. Visualizza anche i tuoi obiettivi attivi con il progresso in tempo reale!',
      side: 'top',
      align: 'center',
    }
  },

  // Smart Progress Bar
  {
    element: '[data-tour="dashboard-progress-bar"]',
    popover: {
      title: '📊 Barra Progresso Giornaliera',
      description: 'Vedi a colpo d\'occhio quanti task hai completato oggi rispetto al totale. Include il tuo streak di giorni consecutivi e quanto manca al prossimo milestone.',
      side: 'bottom',
      align: 'center',
    }
  },

  // Timeline/Feed
  {
    element: '[data-tour="dashboard-timeline"]',
    popover: {
      title: '📅 La Tua Giornata',
      description: 'Qui vedi tutto quello che hai fatto e devi fare oggi: esercizi completati, in corso o da iniziare, prossime consulenze e riflessioni giornaliere.',
      side: 'top',
      align: 'start',
    }
  },

  // Quick Actions
  {
    element: '[data-tour="dashboard-quick-actions"]',
    popover: {
      title: '⚡ Azioni Rapide',
      description: 'Accesso veloce alle sezioni principali: Libreria corsi, Roadmap formativa, Riflessioni giornaliere e Consulenze con il tuo consulente.',
      side: 'top',
      align: 'center',
    }
  },

  // Badge Display
  {
    element: '[data-tour="dashboard-badges"]',
    popover: {
      title: '🏆 I Tuoi Badge',
      description: 'Raccogli badge per i tuoi traguardi! Completa esercizi, mantieni lo streak e raggiungi obiettivi per sbloccare nuovi badge e certificati.',
      side: 'top',
      align: 'center',
    }
  },

  // Progress Stats
  {
    element: '[data-tour="dashboard-progress-stats"]',
    popover: {
      title: '📈 I Tuoi Progressi',
      description: 'Statistiche dettagliate: esercizi completati, streak di giorni consecutivi, percentuale di completamento complessiva e numero di consulenze effettuate.',
      side: 'top',
      align: 'center',
    }
  },

  // Final
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora conosci tutte le sezioni della Dashboard! Usa questa pagina come punto di partenza per monitorare i tuoi progressi e organizzare la tua giornata. Buon lavoro! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
