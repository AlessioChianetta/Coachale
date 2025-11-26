import { DriveStep } from 'driver.js';

export const libraryLessonsTourSteps: DriveStep[] = [
  {
    element: 'body',
    popover: {
      title: '👋 Guida alle Lezioni del Corso!',
      description: 'Ti mostro come funziona la vista lezioni. Vedrai come cercare, filtrare e accedere alle singole lezioni. Pronto?',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="library-search-lessons"]',
    popover: {
      title: '🔍 Ricerca Lezioni',
      description: 'Usa la barra di ricerca per trovare rapidamente lezioni specifiche per parola chiave, titolo o argomento.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-filters-category"]',
    popover: {
      title: '📁 Filtri Categoria e Sottocategoria',
      description: 'Filtra le lezioni per sottocategoria. Ogni corso può avere diverse sottocategorie per organizzare meglio i contenuti.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-filter-level"]',
    popover: {
      title: '📊 Filtro per Livello',
      description: 'Filtra le lezioni in base al livello di difficoltà: Base (per principianti), Intermedio o Avanzato.',
      side: 'right',
      align: 'start',
    }
  },
  {
    element: '[data-tour="library-lesson-card"]',
    popover: {
      title: '📝 Card Lezione',
      description: 'Ogni card rappresenta una singola lezione. Mostra: anteprima video (se disponibile), titolo, descrizione, durata stimata e livello. Clicca per aprire la lezione.',
      side: 'top',
      align: 'center',
    }
  },
  {
    element: '[data-tour="library-completion-badge"]',
    popover: {
      title: '✅ Badge Completamento',
      description: 'Questo badge verde appare quando hai completato una lezione. Ti aiuta a tenere traccia di cosa hai già studiato!',
      side: 'left',
      align: 'center',
    }
  },
  {
    element: 'body',
    popover: {
      title: '🎉 Perfetto!',
      description: 'Ora sai come navigare tra le lezioni! Usa i filtri per trovare contenuti specifici e clicca su una lezione per iniziare a studiare. Buono studio! 🚀',
      side: 'top',
      align: 'center',
    }
  },
];
