// Sistema di Temi per i Corsi
// Ogni tema definisce colori, stili e classi HTML per le lezioni generate dall'AI

export interface CourseTheme {
  id: string;
  name: string;
  description: string;
  preview: {
    primary: string;
    secondary: string;
    accent: string;
  };
  // Classi Tailwind per i vari elementi
  styles: {
    // Container principale della lezione
    container: string;
    // Titoli delle sezioni (h2)
    sectionTitle: string;
    // Sottotitoli (h3)
    subsectionTitle: string;
    // Paragrafi normali
    paragraph: string;
    // Box per punti chiave
    keyPointsBox: string;
    keyPointsTitle: string;
    keyPointsItem: string;
    // Box per esempi pratici
    exampleBox: string;
    exampleTitle: string;
    exampleContent: string;
    // Box per note/avvisi
    noteBox: string;
    noteTitle: string;
    noteContent: string;
    // Box per azioni/esercizi
    actionBox: string;
    actionTitle: string;
    actionItem: string;
    // Box riepilogo finale
    summaryBox: string;
    summaryTitle: string;
    summaryContent: string;
    // Lista puntata
    bulletList: string;
    bulletItem: string;
    // Citazioni/quote
    quote: string;
    // Divisore sezioni
    divider: string;
  };
  // Icone emoji per i vari elementi
  icons: {
    keyPoints: string;
    example: string;
    note: string;
    action: string;
    summary: string;
    bullet: string;
  };
}

export const COURSE_THEMES: CourseTheme[] = [
  {
    id: 'business',
    name: 'Business',
    description: 'Professionale e formale, ideale per corsi aziendali e finanza',
    preview: {
      primary: '#1e40af',
      secondary: '#dbeafe',
      accent: '#3b82f6',
    },
    styles: {
      container: 'font-sans leading-relaxed',
      sectionTitle: 'text-2xl font-bold text-blue-900 dark:text-blue-100 border-b-2 border-blue-600 pb-2 mb-4 mt-8',
      subsectionTitle: 'text-xl font-semibold text-blue-800 dark:text-blue-200 mt-6 mb-3',
      paragraph: 'text-gray-700 dark:text-gray-300 mb-4 leading-7',
      keyPointsBox: 'bg-blue-50 dark:bg-blue-950/30 border-l-4 border-blue-600 rounded-r-lg p-4 my-4',
      keyPointsTitle: 'text-lg font-bold text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2',
      keyPointsItem: 'text-blue-800 dark:text-blue-200 mb-1 flex items-start gap-2',
      exampleBox: 'bg-slate-100 dark:bg-slate-800/50 border border-slate-300 dark:border-slate-600 rounded-xl p-4 my-4',
      exampleTitle: 'text-lg font-semibold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2',
      exampleContent: 'text-slate-700 dark:text-slate-300',
      noteBox: 'bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 rounded-lg p-3 my-4',
      noteTitle: 'text-amber-800 dark:text-amber-200 font-semibold mb-1 flex items-center gap-2',
      noteContent: 'text-amber-700 dark:text-amber-300',
      actionBox: 'bg-green-50 dark:bg-green-950/30 border-2 border-green-500 rounded-xl p-4 my-4',
      actionTitle: 'text-lg font-bold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2',
      actionItem: 'text-green-700 dark:text-green-300 mb-1 pl-6 relative before:content-["✓"] before:absolute before:left-0 before:text-green-600',
      summaryBox: 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-300 dark:border-blue-700 rounded-2xl p-4 my-5',
      summaryTitle: 'text-xl font-bold text-blue-900 dark:text-blue-100 mb-4 flex items-center gap-2',
      summaryContent: 'text-blue-800 dark:text-blue-200',
      bulletList: 'space-y-2 my-4',
      bulletItem: 'flex items-start gap-3 text-gray-700 dark:text-gray-300',
      quote: 'border-l-4 border-blue-400 pl-4 italic text-gray-600 dark:text-gray-400 my-4',
      divider: 'border-t border-blue-200 dark:border-blue-800 my-8',
    },
    icons: {
      keyPoints: '📌',
      example: '💼',
      note: '⚠️',
      action: '✅',
      summary: '📋',
      bullet: '▸',
    },
  },
  {
    id: 'wellness',
    name: 'Wellness',
    description: 'Rilassante e accogliente, ideale per benessere e crescita personale',
    preview: {
      primary: '#059669',
      secondary: '#d1fae5',
      accent: '#10b981',
    },
    styles: {
      container: 'font-sans leading-relaxed',
      sectionTitle: 'text-2xl font-semibold text-emerald-800 dark:text-emerald-200 mb-4 mt-8 flex items-center gap-3',
      subsectionTitle: 'text-xl font-medium text-emerald-700 dark:text-emerald-300 mt-6 mb-3',
      paragraph: 'text-gray-600 dark:text-gray-300 mb-4 leading-8',
      keyPointsBox: 'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-2xl p-4 my-4 shadow-sm',
      keyPointsTitle: 'text-lg font-semibold text-emerald-800 dark:text-emerald-200 mb-2 flex items-center gap-2',
      keyPointsItem: 'text-emerald-700 dark:text-emerald-300 mb-1 flex items-start gap-2',
      exampleBox: 'bg-purple-50 dark:bg-purple-950/30 rounded-2xl p-4 my-4 border border-purple-200 dark:border-purple-800',
      exampleTitle: 'text-lg font-semibold text-purple-800 dark:text-purple-200 mb-2 flex items-center gap-2',
      exampleContent: 'text-purple-700 dark:text-purple-300',
      noteBox: 'bg-rose-50 dark:bg-rose-950/30 rounded-xl p-3 my-4 border border-rose-200 dark:border-rose-800',
      noteTitle: 'text-rose-700 dark:text-rose-300 font-medium mb-1 flex items-center gap-2',
      noteContent: 'text-rose-600 dark:text-rose-400',
      actionBox: 'bg-gradient-to-r from-green-100 to-emerald-100 dark:from-green-950/40 dark:to-emerald-950/40 rounded-2xl p-4 my-4',
      actionTitle: 'text-lg font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2',
      actionItem: 'text-green-700 dark:text-green-300 mb-2 pl-6 relative before:content-["🌱"] before:absolute before:left-0',
      summaryBox: 'bg-gradient-to-br from-teal-100 via-emerald-100 to-green-100 dark:from-teal-950/40 dark:via-emerald-950/40 dark:to-green-950/40 rounded-3xl p-5 my-5 shadow-lg',
      summaryTitle: 'text-xl font-semibold text-teal-800 dark:text-teal-200 mb-4 flex items-center gap-2',
      summaryContent: 'text-teal-700 dark:text-teal-300',
      bulletList: 'space-y-3 my-4',
      bulletItem: 'flex items-start gap-3 text-gray-600 dark:text-gray-300',
      quote: 'bg-emerald-50 dark:bg-emerald-950/20 rounded-xl p-4 border-l-4 border-emerald-400 italic text-emerald-700 dark:text-emerald-300 my-4',
      divider: 'border-t border-emerald-200 dark:border-emerald-800 my-8',
    },
    icons: {
      keyPoints: '🌟',
      example: '🧘',
      note: '💚',
      action: '🌱',
      summary: '✨',
      bullet: '○',
    },
  },
  {
    id: 'creative',
    name: 'Creativo',
    description: 'Dinamico e vivace, ideale per corsi creativi e marketing',
    preview: {
      primary: '#ea580c',
      secondary: '#fff7ed',
      accent: '#f97316',
    },
    styles: {
      container: 'font-sans leading-relaxed',
      sectionTitle: 'text-2xl font-bold text-orange-600 dark:text-orange-400 mb-4 mt-8',
      subsectionTitle: 'text-xl font-semibold text-amber-600 dark:text-amber-400 mt-6 mb-3',
      paragraph: 'text-gray-700 dark:text-gray-300 mb-4 leading-7',
      keyPointsBox: 'bg-gradient-to-r from-orange-100 to-yellow-100 dark:from-orange-950/40 dark:to-yellow-950/40 rounded-xl p-4 my-4 border-2 border-orange-300 dark:border-orange-700',
      keyPointsTitle: 'text-lg font-bold text-orange-700 dark:text-orange-300 mb-2 flex items-center gap-2',
      keyPointsItem: 'text-orange-800 dark:text-orange-200 mb-1 flex items-start gap-2',
      exampleBox: 'bg-pink-50 dark:bg-pink-950/30 rounded-xl p-4 my-4 border border-pink-300 dark:border-pink-700',
      exampleTitle: 'text-lg font-bold text-pink-700 dark:text-pink-300 mb-2 flex items-center gap-2',
      exampleContent: 'text-pink-600 dark:text-pink-400',
      noteBox: 'bg-yellow-100 dark:bg-yellow-950/40 rounded-lg p-3 my-4 border-l-4 border-yellow-500',
      noteTitle: 'text-yellow-800 dark:text-yellow-200 font-bold mb-1 flex items-center gap-2',
      noteContent: 'text-yellow-700 dark:text-yellow-300',
      actionBox: 'bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-950/40 dark:to-orange-950/40 rounded-2xl p-4 my-4 border-2 border-red-400 dark:border-red-600',
      actionTitle: 'text-lg font-bold text-red-700 dark:text-red-300 mb-2 flex items-center gap-2',
      actionItem: 'text-red-600 dark:text-red-400 mb-1 pl-6 relative before:content-["🔥"] before:absolute before:left-0',
      summaryBox: 'bg-gradient-to-r from-orange-200 via-pink-200 to-purple-200 dark:from-orange-950/50 dark:via-pink-950/50 dark:to-purple-950/50 rounded-2xl p-4 my-5 shadow-xl',
      summaryTitle: 'text-xl font-bold text-orange-800 dark:text-orange-200 mb-4 flex items-center gap-2',
      summaryContent: 'text-orange-700 dark:text-orange-300',
      bulletList: 'space-y-2 my-4',
      bulletItem: 'flex items-start gap-3 text-gray-700 dark:text-gray-300',
      quote: 'bg-gradient-to-r from-orange-50 to-pink-50 dark:from-orange-950/20 dark:to-pink-950/20 rounded-lg p-4 border-l-4 border-orange-400 italic text-orange-700 dark:text-orange-300 my-4',
      divider: 'border-t-2 border-dashed border-orange-300 dark:border-orange-700 my-8',
    },
    icons: {
      keyPoints: '💡',
      example: '🎨',
      note: '⚡',
      action: '🔥',
      summary: '🚀',
      bullet: '★',
    },
  },
  {
    id: 'tech',
    name: 'Tecnico',
    description: 'Moderno e pulito, ideale per corsi tecnici e programmazione',
    preview: {
      primary: '#0f766e',
      secondary: '#f0fdfa',
      accent: '#14b8a6',
    },
    styles: {
      container: 'font-mono leading-relaxed',
      sectionTitle: 'text-2xl font-bold text-teal-700 dark:text-teal-300 border-b border-teal-500 pb-2 mb-4 mt-8',
      subsectionTitle: 'text-xl font-semibold text-cyan-700 dark:text-cyan-300 mt-6 mb-3',
      paragraph: 'text-gray-700 dark:text-gray-300 mb-4 leading-7 font-sans',
      keyPointsBox: 'bg-gray-900 dark:bg-gray-950 text-green-400 rounded-lg p-4 my-4 border border-gray-700 font-mono',
      keyPointsTitle: 'text-lg font-bold text-green-300 mb-2 flex items-center gap-2',
      keyPointsItem: 'text-green-400 mb-1 flex items-start gap-2 before:content-[">"] before:text-green-500',
      exampleBox: 'bg-slate-800 dark:bg-slate-900 rounded-lg p-4 my-4 border border-slate-600',
      exampleTitle: 'text-lg font-semibold text-cyan-400 mb-2 flex items-center gap-2',
      exampleContent: 'text-slate-300 font-mono text-sm',
      noteBox: 'bg-yellow-950/50 border border-yellow-700 rounded-lg p-3 my-4',
      noteTitle: 'text-yellow-400 font-semibold mb-1 flex items-center gap-2',
      noteContent: 'text-yellow-300 font-sans',
      actionBox: 'bg-teal-950 border-2 border-teal-500 rounded-lg p-4 my-4',
      actionTitle: 'text-lg font-bold text-teal-300 mb-2 flex items-center gap-2',
      actionItem: 'text-teal-200 mb-1 pl-6 relative before:content-["$"] before:absolute before:left-0 before:text-teal-500 font-mono',
      summaryBox: 'bg-gradient-to-r from-gray-800 to-slate-800 dark:from-gray-900 dark:to-slate-900 rounded-xl p-4 my-5 border border-teal-600',
      summaryTitle: 'text-xl font-bold text-teal-400 mb-4 flex items-center gap-2',
      summaryContent: 'text-gray-300 font-sans',
      bulletList: 'space-y-2 my-4 font-sans',
      bulletItem: 'flex items-start gap-3 text-gray-300',
      quote: 'bg-gray-800 rounded-lg p-4 border-l-4 border-teal-500 text-gray-400 italic my-4 font-sans',
      divider: 'border-t border-teal-700 my-8',
    },
    icons: {
      keyPoints: '🔧',
      example: '💻',
      note: '📝',
      action: '⚙️',
      summary: '📊',
      bullet: '→',
    },
  },
  {
    id: 'classic',
    name: 'Classico',
    description: 'Elegante e tradizionale, adatto a qualsiasi tipo di corso',
    preview: {
      primary: '#374151',
      secondary: '#f9fafb',
      accent: '#6b7280',
    },
    styles: {
      container: 'font-serif leading-relaxed',
      sectionTitle: 'text-2xl font-bold text-gray-800 dark:text-gray-200 border-b border-gray-300 dark:border-gray-600 pb-2 mb-4 mt-8',
      subsectionTitle: 'text-xl font-semibold text-gray-700 dark:text-gray-300 mt-6 mb-3',
      paragraph: 'text-gray-600 dark:text-gray-400 mb-4 leading-8',
      keyPointsBox: 'bg-gray-100 dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 my-4',
      keyPointsTitle: 'text-lg font-bold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-2',
      keyPointsItem: 'text-gray-700 dark:text-gray-300 mb-1 flex items-start gap-2',
      exampleBox: 'bg-stone-100 dark:bg-stone-800/50 rounded-lg p-4 my-4 border border-stone-300 dark:border-stone-600',
      exampleTitle: 'text-lg font-semibold text-stone-700 dark:text-stone-300 mb-2 flex items-center gap-2',
      exampleContent: 'text-stone-600 dark:text-stone-400',
      noteBox: 'bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 my-4',
      noteTitle: 'text-blue-700 dark:text-blue-300 font-semibold mb-1 flex items-center gap-2',
      noteContent: 'text-blue-600 dark:text-blue-400',
      actionBox: 'bg-green-50 dark:bg-green-950/30 border border-green-300 dark:border-green-700 rounded-lg p-4 my-4',
      actionTitle: 'text-lg font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2',
      actionItem: 'text-green-700 dark:text-green-300 mb-1 pl-6 relative before:content-["•"] before:absolute before:left-2 before:text-green-600',
      summaryBox: 'bg-gray-50 dark:bg-gray-900 border-2 border-gray-300 dark:border-gray-600 rounded-lg p-4 my-5',
      summaryTitle: 'text-xl font-bold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2',
      summaryContent: 'text-gray-700 dark:text-gray-300',
      bulletList: 'space-y-2 my-4',
      bulletItem: 'flex items-start gap-3 text-gray-600 dark:text-gray-400',
      quote: 'border-l-4 border-gray-400 pl-4 italic text-gray-500 dark:text-gray-500 my-4',
      divider: 'border-t border-gray-300 dark:border-gray-600 my-8',
    },
    icons: {
      keyPoints: '•',
      example: '→',
      note: '※',
      action: '□',
      summary: '◆',
      bullet: '—',
    },
  },
];

export function getThemeById(themeId: string): CourseTheme {
  return COURSE_THEMES.find(t => t.id === themeId) || COURSE_THEMES.find(t => t.id === 'classic')!;
}

export function getThemeNames(): { id: string; name: string; description: string }[] {
  return COURSE_THEMES.map(t => ({ id: t.id, name: t.name, description: t.description }));
}

// Genera le istruzioni HTML per l'AI basate sul tema selezionato
export function generateThemeInstructionsForAI(theme: CourseTheme): string {
  return `
FORMATTAZIONE HTML CON TEMA "${theme.name.toUpperCase()}":
Genera il contenuto della lezione in HTML valido usando ESATTAMENTE queste classi Tailwind CSS.

STRUTTURA GENERALE:
<div class="${theme.styles.container}">
  <!-- Contenuto della lezione qui -->
</div>

ELEMENTI DA USARE:

1. TITOLI SEZIONE (usa per dividere la lezione in parti):
<h2 class="${theme.styles.sectionTitle}">Titolo Sezione</h2>

2. SOTTOTITOLI:
<h3 class="${theme.styles.subsectionTitle}">Sottotitolo</h3>

3. PARAGRAFI:
<p class="${theme.styles.paragraph}">Testo del paragrafo...</p>

4. BOX PUNTI CHIAVE (per concetti importanti):
<div class="${theme.styles.keyPointsBox}">
  <div class="${theme.styles.keyPointsTitle}">${theme.icons.keyPoints} Punti Chiave</div>
  <div class="${theme.styles.keyPointsItem}">${theme.icons.bullet} Punto importante 1</div>
  <div class="${theme.styles.keyPointsItem}">${theme.icons.bullet} Punto importante 2</div>
</div>

5. BOX ESEMPIO PRATICO:
<div class="${theme.styles.exampleBox}">
  <div class="${theme.styles.exampleTitle}">${theme.icons.example} Esempio Pratico</div>
  <div class="${theme.styles.exampleContent}">Descrizione dell'esempio...</div>
</div>

6. BOX NOTA/AVVISO:
<div class="${theme.styles.noteBox}">
  <div class="${theme.styles.noteTitle}">${theme.icons.note} Nota Importante</div>
  <div class="${theme.styles.noteContent}">Contenuto della nota...</div>
</div>

7. BOX AZIONI/ESERCIZI (per passi pratici):
<div class="${theme.styles.actionBox}">
  <div class="${theme.styles.actionTitle}">${theme.icons.action} Cosa Fare Adesso</div>
  <div class="${theme.styles.actionItem}">Primo passo da fare</div>
  <div class="${theme.styles.actionItem}">Secondo passo da fare</div>
</div>

8. BOX RIEPILOGO FINALE:
<div class="${theme.styles.summaryBox}">
  <div class="${theme.styles.summaryTitle}">${theme.icons.summary} Riepilogo</div>
  <div class="${theme.styles.summaryContent}">Sintesi dei punti principali...</div>
</div>

9. LISTE PUNTATE:
<ul class="${theme.styles.bulletList}">
  <li class="${theme.styles.bulletItem}">${theme.icons.bullet} Elemento lista</li>
</ul>

10. CITAZIONI:
<blockquote class="${theme.styles.quote}">Citazione o frase importante...</blockquote>

11. DIVISORE TRA SEZIONI:
<hr class="${theme.styles.divider}" />

REGOLE IMPORTANTI:
- Usa SOLO le classi Tailwind fornite sopra
- NON usare markdown (##, **, etc) - genera SOLO HTML
- Struttura la lezione con 3-5 sezioni principali
- Ogni sezione deve avere almeno un box speciale (punti chiave, esempio, nota)
- Termina sempre con un box riepilogo
- Mantieni il tono e lo stile del relatore originale
`;
}
