export interface ScriptMetadata {
  name: string;
  type: 'discovery' | 'demo' | 'objections';
  version: string;
  description?: string;
}

export interface GlobalRule {
  id: string;
  type: 'critical' | 'golden' | 'reminder';
  title: string;
  content: string;
  items?: string[];
}

export interface EnergySettings {
  level: string;
  tone: string;
  volume: string;
  rhythm: string;
  inflections?: string;
  vocabulary: string[];
  negativeVocabulary?: string[];
  mindset?: string;
  example?: string;
}

export interface QuestionInstructions {
  wait: boolean;
  waitDetails?: string;
  listen?: string;
  react?: string[];
  reactContext?: string;
  additionalInstructions?: string[];
}

export interface Question {
  id: string;
  type?: 'question';
  text: string;
  marker?: string;
  instructions?: QuestionInstructions;
  isKey?: boolean;
  condition?: string;
}

export interface Biscottino {
  trigger: string;
  phrase: string;
}

export interface LadderLevel {
  number: number;
  name: string;
  objective?: string;
  question: string;
  examples?: { clientSays: string; youSay: string }[];
  notes?: string;
}

export interface Ladder {
  title: string;
  whenToUse?: string[];
  levels: LadderLevel[];
  stopWhen?: string[];
}

export interface ResistanceStep {
  action: string;
  script: string;
}

export interface ResistanceHandling {
  trigger: string;
  response: string;
  steps?: ResistanceStep[];
}

export interface Checkpoint {
  title: string;
  phaseNumber?: string;
  checks: string[];
  resistanceHandling?: ResistanceHandling;
  reminder?: string;
  testFinale?: string;
}

export interface Step {
  id: string;
  type?: 'step';
  number: number;
  name: string;
  objective: string;
  energy?: EnergySettings;
  questions: Question[];
  biscottino?: Biscottino;
  ladder?: Ladder;
  notes?: string;
  transition?: string;
}

export interface Phase {
  id: string;
  type?: 'phase';
  number: string;
  name: string;
  description?: string;
  energy?: EnergySettings;
  steps: Step[];
  checkpoint?: Checkpoint;
  transition?: string;
}

export interface Objection {
  id: string;
  type?: 'objection';
  number: number;
  title: string;
  variants?: string[];
  objective: string;
  energy?: EnergySettings;
  ladder?: Ladder;
  reframe: string;
  keyQuestion: string;
  cta?: string;
  analogy?: string;
  steps?: Step[];
}

export interface ScriptBlockStructure {
  metadata: ScriptMetadata;
  globalRules: GlobalRule[];
  phases: Phase[];
  objections?: Objection[];
  finalRules?: GlobalRule[];
}

export type BlockType = 
  | 'metadata'
  | 'globalRule'
  | 'phase'
  | 'energy'
  | 'step'
  | 'question'
  | 'biscottino'
  | 'checkpoint'
  | 'ladder'
  | 'resistance'
  | 'transition'
  | 'objection'
  | 'reframe';

export interface BlockItem {
  id: string;
  type: BlockType;
  data: any;
  isExpanded?: boolean;
  isEditing?: boolean;
}

export const BLOCK_COLORS: Record<BlockType, string> = {
  metadata: 'bg-slate-100 border-slate-300 dark:bg-slate-800 dark:border-slate-600',
  globalRule: 'bg-red-50 border-red-300 dark:bg-red-950 dark:border-red-800',
  phase: 'bg-blue-50 border-blue-300 dark:bg-blue-950 dark:border-blue-800',
  energy: 'bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-800',
  step: 'bg-green-50 border-green-300 dark:bg-green-950 dark:border-green-800',
  question: 'bg-purple-50 border-purple-300 dark:bg-purple-950 dark:border-purple-800',
  biscottino: 'bg-amber-50 border-amber-300 dark:bg-amber-950 dark:border-amber-800',
  checkpoint: 'bg-orange-50 border-orange-300 dark:bg-orange-950 dark:border-orange-800',
  ladder: 'bg-indigo-50 border-indigo-300 dark:bg-indigo-950 dark:border-indigo-800',
  resistance: 'bg-rose-50 border-rose-300 dark:bg-rose-950 dark:border-rose-800',
  transition: 'bg-cyan-50 border-cyan-300 dark:bg-cyan-950 dark:border-cyan-800',
  objection: 'bg-pink-50 border-pink-300 dark:bg-pink-950 dark:border-pink-800',
  reframe: 'bg-teal-50 border-teal-300 dark:bg-teal-950 dark:border-teal-800',
};

export const BLOCK_ICONS: Record<BlockType, string> = {
  metadata: '📋',
  globalRule: '🚨',
  phase: '📍',
  energy: '⚡',
  step: '🎯',
  question: '📌',
  biscottino: '🍪',
  checkpoint: '⛔',
  ladder: '🔍',
  resistance: '🛡️',
  transition: '➡️',
  objection: '💬',
  reframe: '🔄',
};

export const BLOCK_LABELS: Record<BlockType, string> = {
  metadata: 'Informazioni Script',
  globalRule: 'Regola Critica',
  phase: 'Fase',
  energy: 'Energia & Tonalità',
  step: 'Step',
  question: 'Domanda',
  biscottino: 'Biscottino',
  checkpoint: 'Checkpoint',
  ladder: 'Ladder dei Perché',
  resistance: 'Gestione Resistenza',
  transition: 'Transizione',
  objection: 'Obiezione',
  reframe: 'Reframe',
};
