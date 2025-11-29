import type { Phase, Step, Question, ScriptBlockStructure, BlockType, EnergySettings, Ladder, Checkpoint, Biscottino } from '@shared/script-blocks';

export type BuilderMode = 'manual' | 'template' | 'ai';

export type ScriptType = 'discovery' | 'demo' | 'objections';

export interface DraggableBlockData {
  blockType: BlockType;
  defaultData?: Partial<Phase | Step | Question>;
}

export interface CanvasSection {
  id: string;
  type: 'initial' | 'content' | 'final';
  isLocked: boolean;
  title: string;
  description: string;
  content?: string;
}



export interface BuilderState {
  mode: BuilderMode;
  scriptType: ScriptType;
  scriptName: string;
  phases: Phase[];
  selectedBlockId: string | null;
  selectedBlockType: 'phase' | 'step' | 'question' | null;
  isDirty: boolean;
  isLoading: boolean;
  error: string | null;
}

export type ScriptBlock = Phase | Step | Question;

export interface BuilderContextValue extends BuilderState {
  setMode: (mode: BuilderMode) => void;
  setScriptType: (type: ScriptType) => void;
  setScriptName: (name: string) => void;
  setPhases: (phases: Phase[]) => void;
  addPhase: (phase?: Partial<Phase>) => void;
  updatePhase: (phaseId: string, data: Partial<Phase>) => void;
  deletePhase: (phaseId: string) => void;
  movePhase: (fromIndex: number, toIndex: number) => void;
  addStep: (phaseId: string, step?: Partial<Step>) => void;
  updateStep: (phaseId: string, stepId: string, data: Partial<Step>) => void;
  deleteStep: (phaseId: string, stepId: string) => void;
  moveStep: (phaseId: string, fromIndex: number, toIndex: number) => void;
  addQuestion: (phaseId: string, stepId: string, question?: Partial<Question>) => void;
  updateQuestion: (phaseId: string, stepId: string, questionId: string, data: Partial<Question>) => void;
  deleteQuestion: (phaseId: string, stepId: string, questionId: string) => void;
  moveQuestion: (phaseId: string, stepId: string, fromIndex: number, toIndex: number) => void;
  selectBlock: (blockId: string | null, blockType: 'phase' | 'step' | 'question' | null) => void;
  getSelectedBlock: () => ScriptBlock | null;
  updateInitialSection: (data: Partial<InitialSectionData>) => void;
  updateFinalSection: (data: Partial<FinalSectionData>) => void;
  loadFromStructure: (structure: ScriptBlockStructure) => void;
  toStructure: () => ScriptBlockStructure;
  reset: () => void;
  setIsDirty: (dirty: boolean) => void;
  setIsLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export interface TemplateOption {
  id: string;
  name: string;
  description: string;
  type: ScriptType;
  preview?: string;
}

export interface AgentConfig {
  id: string;
  agentName: string;
  displayName: string;
  businessName: string;
  businessDescription?: string;
  targetClient?: string;
  usp?: string;
  values?: string[];
  mission?: string;
  vision?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
}

export interface AIGenerationRequest {
  templateId: string;
  agentId: string;
  userComment?: string;
}

export interface AIGenerationResponse {
  success: boolean;
  structure?: ScriptBlockStructure;
  error?: string;
}

export const DEFAULT_INITIAL_SECTION: InitialSectionData = {
  greeting: "Ciao [NOME], piacere di conoscerti! Grazie per aver dedicato del tempo a questa call.",
  introduction: "Sono [TUO_NOME] e oggi parleremo di come posso aiutarti a raggiungere i tuoi obiettivi.",
  agendaSetting: "In questa chiamata voglio capire meglio la tua situazione attuale, dove vorresti arrivare, e vedere se possiamo lavorare insieme. Ti va bene?",
};

export const DEFAULT_FINAL_SECTION: FinalSectionData = {
  recap: "Perfetto, ricapitoliamo: hai detto che [RIASSUNTO_PUNTI_CHIAVE]...",
  cta: "Sulla base di quello che mi hai detto, credo che [OFFERTA] sia la soluzione perfetta per te. Che ne dici di procedere?",
  closing: "Grazie per il tempo che mi hai dedicato. Ti mando subito i dettagli via email.",
};

export const PALETTE_CATEGORIES = [
  {
    id: 'structure',
    label: 'Struttura',
    description: 'Elementi per organizzare lo script',
    blocks: ['phase', 'step'] as BlockType[],
  },
  {
    id: 'content',
    label: 'Contenuto',
    description: 'Elementi di contenuto',
    blocks: ['question'] as BlockType[],
  },
  {
    id: 'behavior',
    label: 'Comportamento',
    description: 'Modificatori di comportamento AI',
    blocks: ['energy', 'ladder', 'biscottino', 'checkpoint'] as BlockType[],
  },
] as const;
