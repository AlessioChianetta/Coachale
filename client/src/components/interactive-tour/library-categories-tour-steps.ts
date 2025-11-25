import { DriveStep } from 'driver.js';

export const libraryCategoriesTourSteps: DriveStep[] = [
  {
    element: 'body',
    popover: {
      title: '👋 Benvenuto nella Libreria Corsi!',
      description: 'Ti mostro come funziona la pagina principale dei corsi. Vedrai tutte le categorie disponibili e come accedere alle lezioni. Pronto?',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="library-header"]',
    popover: {
      title: '📚 Corsi',
      description: 'Questa è la pagina principale dei corsi. Qui vedi tutte le categorie disponibili.',
      side: 'bottom',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-progress-card"]',
    popover: {
      title: '📊 Il Tuo Progresso Formativo',
      description: 'Qui puoi vedere il tuo progresso complessivo in tutti i corsi. Visualizza percentuale di completamento, lezioni completate e il tuo livello attuale.',
      side: 'bottom',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-courses-available"]',
    popover: {
      title: '📖 Corsi Disponibili',
      description: 'Il numero totale di corsi disponibili nella piattaforma. Ogni corso contiene multiple lezioni.',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="library-lessons-completed"]',
    popover: {
      title: '✅ Lezioni Completate',
      description: 'Il numero di lezioni che hai completato finora. Continua così per raggiungere i tuoi obiettivi!',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: '[data-tour="library-categories-grid"]',
    popover: {
      title: '🎯 Griglia delle Categorie',
      description: 'Qui vedi TUTTE le categorie di corsi disponibili. Ogni card mostra: immagine di anteprima, titolo, descrizione, numero di lezioni e progresso.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="library-category-card"]',
    popover: {
      title: '📋 Card Categoria',
      description: 'Ogni card rappresenta un corso completo. Puoi vedere: immagine, titolo, descrizione, numero di lezioni e il tuo progresso.',
      side: 'top',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-category-progress"]',
    popover: {
      title: '📈 Progresso per Categoria',
      description: 'Barra di progresso che mostra quante lezioni hai completato in questa specifica categoria.',
      side: 'top',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-category-button"]',
    popover: {
      title: '▶️ Inizia o Continua il Corso',
      description: 'Clicca questo bottone per entrare nella categoria e vedere tutte le lezioni disponibili. Se non hai iniziato dice "Inizia il corso", altrimenti "Continua il corso".',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come navigare tra le categorie dei corsi! Clicca su una categoria per vedere le lezioni disponibili. Buono studio! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
