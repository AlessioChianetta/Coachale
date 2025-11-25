import { DriveStep } from 'driver.js';

export const consultationsTourSteps: DriveStep[] = [
  {
    element: 'body',
    popover: {
      title: '🤝 Benvenuto alle Consulenze!',
      description: 'Ti mostro come gestire le tue sessioni di consulenza, le video call e i follow-up con il tuo consulente. Pronto?',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="consultations-list"]',
    popover: {
      title: '📋 Lista Consulenze',
      description: 'Qui vedi tutte le tue consulenze: passate, in programma e future. Ogni card mostra data, ora, status e dettagli importanti.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="consultations-filters"]',
    popover: {
      title: '🔍 Filtri',
      description: 'Filtra le consulenze per stato: Tutte, Programmate, Completate o Cancellate. Trova velocemente ciò che cerchi!',
      side: 'bottom',
      align: 'start',
    }
  },
  {
    element: '[data-tour="consultations-upcoming-card"]',
    popover: {
      title: '🔜 Prossima Consulenza',
      description: 'La prossima consulenza è evidenziata con colore speciale. Mostra il countdown e il link diretto alla video call!',
      side: 'left',
      align: 'start',
    }
  },
  {
    element: '[data-tour="consultations-video-call-btn"]',
    popover: {
      title: '🎥 Video Call',
      description: 'Clicca per entrare nella video call Fathom. Il link si attiva 15 minuti prima dell\'orario programmato.',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="consultations-details"]',
    popover: {
      title: '📝 Dettagli Consulenza',
      description: 'Ogni consulenza mostra: titolo, descrizione, data, ora, durata, status e note del consulente.',
      side: 'top',
      align: 'start',
    }
  },
  {
    element: '[data-tour="consultations-tasks"]',
    popover: {
      title: '✅ Task Associati',
      description: 'I task assegnati durante la consulenza appaiono qui. Puoi completarli direttamente dalla card!',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="consultations-ai-summary"]',
    popover: {
      title: '🤖 Riepilogo AI',
      description: 'Dopo ogni consulenza, l\'AI genera un riepilogo automatico con i punti chiave discussi e le azioni da intraprendere.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="consultations-feedback"]',
    popover: {
      title: '⭐ Feedback',
      description: 'Lascia un feedback e una valutazione dopo ogni consulenza per aiutare il tuo consulente a migliorare il servizio.',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="consultations-request-new"]',
    popover: {
      title: '➕ Richiedi Consulenza',
      description: 'Clicca qui per richiedere una nuova consulenza. Scegli la data, ora e l\'argomento che vuoi discutere.',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come gestire le tue consulenze! Preparati bene prima di ogni sessione e segui i task assegnati per massimizzare i risultati! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
