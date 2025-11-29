import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import type { Phase, Step, Question, ScriptBlockStructure } from '@shared/script-blocks';
import type {
  BuilderState,
  BuilderContextValue,
  BuilderMode,
  ScriptType,
  InitialSectionData,
  FinalSectionData,
  ScriptBlock,
} from './types';
import { DEFAULT_INITIAL_SECTION, DEFAULT_FINAL_SECTION } from './types';

type BuilderAction =
  | { type: 'SET_MODE'; payload: BuilderMode }
  | { type: 'SET_SCRIPT_TYPE'; payload: ScriptType }
  | { type: 'SET_SCRIPT_NAME'; payload: string }
  | { type: 'SET_PHASES'; payload: Phase[] }
  | { type: 'ADD_PHASE'; payload: Partial<Phase> | undefined }
  | { type: 'UPDATE_PHASE'; payload: { phaseId: string; data: Partial<Phase> } }
  | { type: 'DELETE_PHASE'; payload: string }
  | { type: 'MOVE_PHASE'; payload: { fromIndex: number; toIndex: number } }
  | { type: 'ADD_STEP'; payload: { phaseId: string; step?: Partial<Step> } }
  | { type: 'UPDATE_STEP'; payload: { phaseId: string; stepId: string; data: Partial<Step> } }
  | { type: 'DELETE_STEP'; payload: { phaseId: string; stepId: string } }
  | { type: 'MOVE_STEP'; payload: { phaseId: string; fromIndex: number; toIndex: number } }
  | { type: 'ADD_QUESTION'; payload: { phaseId: string; stepId: string; question?: Partial<Question> } }
  | { type: 'UPDATE_QUESTION'; payload: { phaseId: string; stepId: string; questionId: string; data: Partial<Question> } }
  | { type: 'DELETE_QUESTION'; payload: { phaseId: string; stepId: string; questionId: string } }
  | { type: 'MOVE_QUESTION'; payload: { phaseId: string; stepId: string; fromIndex: number; toIndex: number } }
  | { type: 'SELECT_BLOCK'; payload: { blockId: string | null; blockType: 'phase' | 'step' | 'question' | null } }
  | { type: 'UPDATE_INITIAL_SECTION'; payload: Partial<InitialSectionData> }
  | { type: 'UPDATE_FINAL_SECTION'; payload: Partial<FinalSectionData> }
  | { type: 'LOAD_FROM_STRUCTURE'; payload: ScriptBlockStructure }
  | { type: 'RESET' }
  | { type: 'SET_IS_DIRTY'; payload: boolean }
  | { type: 'SET_IS_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

const generateId = (prefix: string) => `${prefix}_${crypto.randomUUID().slice(0, 8)}`;

const initialState: BuilderState = {
  mode: 'manual',
  scriptType: 'discovery',
  scriptName: 'Nuovo Script',
  phases: [],
  initialSection: DEFAULT_INITIAL_SECTION,
  finalSection: DEFAULT_FINAL_SECTION,
  selectedBlockId: null,
  selectedBlockType: null,
  isDirty: false,
  isLoading: false,
  error: null,
};

function builderReducer(state: BuilderState, action: BuilderAction): BuilderState {
  switch (action.type) {
    case 'SET_MODE':
      return { ...state, mode: action.payload, isDirty: true };

    case 'SET_SCRIPT_TYPE':
      return { ...state, scriptType: action.payload, isDirty: true };

    case 'SET_SCRIPT_NAME':
      return { ...state, scriptName: action.payload, isDirty: true };

    case 'SET_PHASES':
      return { ...state, phases: action.payload, isDirty: true };

    case 'ADD_PHASE': {
      const newPhase: Phase = {
        id: generateId('phase'),
        type: 'phase',
        number: String(state.phases.length + 1),
        name: action.payload?.name || 'Nuova Fase',
        description: action.payload?.description || '',
        steps: [],
        ...action.payload,
      };
      return { ...state, phases: [...state.phases, newPhase], isDirty: true };
    }

    case 'UPDATE_PHASE': {
      const phases = state.phases.map(p =>
        p.id === action.payload.phaseId ? { ...p, ...action.payload.data } : p
      );
      return { ...state, phases, isDirty: true };
    }

    case 'DELETE_PHASE': {
      const phases = state.phases
        .filter(p => p.id !== action.payload)
        .map((p, idx) => ({ ...p, number: String(idx + 1) }));
      return {
        ...state,
        phases,
        selectedBlockId: state.selectedBlockId === action.payload ? null : state.selectedBlockId,
        selectedBlockType: state.selectedBlockId === action.payload ? null : state.selectedBlockType,
        isDirty: true,
      };
    }

    case 'MOVE_PHASE': {
      const { fromIndex, toIndex } = action.payload;
      const phases = [...state.phases];
      const [removed] = phases.splice(fromIndex, 1);
      phases.splice(toIndex, 0, removed);
      return {
        ...state,
        phases: phases.map((p, idx) => ({ ...p, number: String(idx + 1) })),
        isDirty: true,
      };
    }

    case 'ADD_STEP': {
      const phases = state.phases.map(phase => {
        if (phase.id === action.payload.phaseId) {
          const newStep: Step = {
            id: generateId('step'),
            type: 'step',
            number: (phase.steps?.length || 0) + 1,
            name: action.payload.step?.name || 'Nuovo Step',
            objective: action.payload.step?.objective || '',
            questions: [],
            ...action.payload.step,
          };
          return { ...phase, steps: [...(phase.steps || []), newStep] };
        }
        return phase;
      });
      return { ...state, phases, isDirty: true };
    }

    case 'UPDATE_STEP': {
      const phases = state.phases.map(phase => {
        if (phase.id === action.payload.phaseId) {
          const steps = (phase.steps || []).map(s =>
            s.id === action.payload.stepId ? { ...s, ...action.payload.data } : s
          );
          return { ...phase, steps };
        }
        return phase;
      });
      return { ...state, phases, isDirty: true };
    }

    case 'DELETE_STEP': {
      const phases = state.phases.map(phase => {
        if (phase.id === action.payload.phaseId) {
          const steps = (phase.steps || [])
            .filter(s => s.id !== action.payload.stepId)
            .map((s, idx) => ({ ...s, number: idx + 1 }));
          return { ...phase, steps };
        }
        return phase;
      });
      return {
        ...state,
        phases,
        selectedBlockId: state.selectedBlockId === action.payload.stepId ? null : state.selectedBlockId,
        selectedBlockType: state.selectedBlockId === action.payload.stepId ? null : state.selectedBlockType,
        isDirty: true,
      };
    }

    case 'MOVE_STEP': {
      const { phaseId, fromIndex, toIndex } = action.payload;
      const phases = state.phases.map(phase => {
        if (phase.id === phaseId) {
          const steps = [...(phase.steps || [])];
          const [removed] = steps.splice(fromIndex, 1);
          steps.splice(toIndex, 0, removed);
          return { ...phase, steps: steps.map((s, idx) => ({ ...s, number: idx + 1 })) };
        }
        return phase;
      });
      return { ...state, phases, isDirty: true };
    }

    case 'ADD_QUESTION': {
      const phases = state.phases.map(phase => {
        if (phase.id === action.payload.phaseId) {
          const steps = (phase.steps || []).map(step => {
            if (step.id === action.payload.stepId) {
              const newQuestion: Question = {
                id: generateId('question'),
                type: 'question',
                text: action.payload.question?.text || 'Nuova domanda...',
                ...action.payload.question,
              };
              return { ...step, questions: [...(step.questions || []), newQuestion] };
            }
            return step;
          });
          return { ...phase, steps };
        }
        return phase;
      });
      return { ...state, phases, isDirty: true };
    }

    case 'UPDATE_QUESTION': {
      const phases = state.phases.map(phase => {
        if (phase.id === action.payload.phaseId) {
          const steps = (phase.steps || []).map(step => {
            if (step.id === action.payload.stepId) {
              const questions = (step.questions || []).map(q =>
                q.id === action.payload.questionId ? { ...q, ...action.payload.data } : q
              );
              return { ...step, questions };
            }
            return step;
          });
          return { ...phase, steps };
        }
        return phase;
      });
      return { ...state, phases, isDirty: true };
    }

    case 'DELETE_QUESTION': {
      const phases = state.phases.map(phase => {
        if (phase.id === action.payload.phaseId) {
          const steps = (phase.steps || []).map(step => {
            if (step.id === action.payload.stepId) {
              const questions = (step.questions || []).filter(q => q.id !== action.payload.questionId);
              return { ...step, questions };
            }
            return step;
          });
          return { ...phase, steps };
        }
        return phase;
      });
      return {
        ...state,
        phases,
        selectedBlockId: state.selectedBlockId === action.payload.questionId ? null : state.selectedBlockId,
        selectedBlockType: state.selectedBlockId === action.payload.questionId ? null : state.selectedBlockType,
        isDirty: true,
      };
    }

    case 'MOVE_QUESTION': {
      const { phaseId, stepId, fromIndex, toIndex } = action.payload;
      const phases = state.phases.map(phase => {
        if (phase.id === phaseId) {
          const steps = (phase.steps || []).map(step => {
            if (step.id === stepId) {
              const questions = [...(step.questions || [])];
              const [removed] = questions.splice(fromIndex, 1);
              questions.splice(toIndex, 0, removed);
              return { ...step, questions };
            }
            return step;
          });
          return { ...phase, steps };
        }
        return phase;
      });
      return { ...state, phases, isDirty: true };
    }

    case 'SELECT_BLOCK':
      return {
        ...state,
        selectedBlockId: action.payload.blockId,
        selectedBlockType: action.payload.blockType,
      };

    case 'UPDATE_INITIAL_SECTION':
      return {
        ...state,
        initialSection: { ...state.initialSection, ...action.payload },
        isDirty: true,
      };

    case 'UPDATE_FINAL_SECTION':
      return {
        ...state,
        finalSection: { ...state.finalSection, ...action.payload },
        isDirty: true,
      };

    case 'LOAD_FROM_STRUCTURE': {
      const structure = action.payload;
      const phases = (structure.phases || []).map(phase => ({
        ...phase,
        type: 'phase' as const,
        steps: (phase.steps || []).map(step => ({
          ...step,
          type: 'step' as const,
          questions: (step.questions || []).map(q => ({
            ...q,
            type: 'question' as const,
          })),
        })),
      }));
      return {
        ...state,
        scriptType: structure.metadata?.type || 'discovery',
        scriptName: structure.metadata?.name || 'Script Importato',
        phases,
        isDirty: true,
        selectedBlockId: null,
        selectedBlockType: null,
      };
    }

    case 'RESET':
      return { ...initialState };

    case 'SET_IS_DIRTY':
      return { ...state, isDirty: action.payload };

    case 'SET_IS_LOADING':
      return { ...state, isLoading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    default:
      return state;
  }
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(builderReducer, initialState);

  const setMode = useCallback((mode: BuilderMode) => dispatch({ type: 'SET_MODE', payload: mode }), []);
  const setScriptType = useCallback((type: ScriptType) => dispatch({ type: 'SET_SCRIPT_TYPE', payload: type }), []);
  const setScriptName = useCallback((name: string) => dispatch({ type: 'SET_SCRIPT_NAME', payload: name }), []);
  const setPhases = useCallback((phases: Phase[]) => dispatch({ type: 'SET_PHASES', payload: phases }), []);

  const addPhase = useCallback((phase?: Partial<Phase>) => dispatch({ type: 'ADD_PHASE', payload: phase }), []);
  const updatePhase = useCallback((phaseId: string, data: Partial<Phase>) =>
    dispatch({ type: 'UPDATE_PHASE', payload: { phaseId, data } }), []);
  const deletePhase = useCallback((phaseId: string) => dispatch({ type: 'DELETE_PHASE', payload: phaseId }), []);
  const movePhase = useCallback((fromIndex: number, toIndex: number) =>
    dispatch({ type: 'MOVE_PHASE', payload: { fromIndex, toIndex } }), []);

  const addStep = useCallback((phaseId: string, step?: Partial<Step>) =>
    dispatch({ type: 'ADD_STEP', payload: { phaseId, step } }), []);
  const updateStep = useCallback((phaseId: string, stepId: string, data: Partial<Step>) =>
    dispatch({ type: 'UPDATE_STEP', payload: { phaseId, stepId, data } }), []);
  const deleteStep = useCallback((phaseId: string, stepId: string) =>
    dispatch({ type: 'DELETE_STEP', payload: { phaseId, stepId } }), []);
  const moveStep = useCallback((phaseId: string, fromIndex: number, toIndex: number) =>
    dispatch({ type: 'MOVE_STEP', payload: { phaseId, fromIndex, toIndex } }), []);

  const addQuestion = useCallback((phaseId: string, stepId: string, question?: Partial<Question>) =>
    dispatch({ type: 'ADD_QUESTION', payload: { phaseId, stepId, question } }), []);
  const updateQuestion = useCallback((phaseId: string, stepId: string, questionId: string, data: Partial<Question>) =>
    dispatch({ type: 'UPDATE_QUESTION', payload: { phaseId, stepId, questionId, data } }), []);
  const deleteQuestion = useCallback((phaseId: string, stepId: string, questionId: string) =>
    dispatch({ type: 'DELETE_QUESTION', payload: { phaseId, stepId, questionId } }), []);
  const moveQuestion = useCallback((phaseId: string, stepId: string, fromIndex: number, toIndex: number) =>
    dispatch({ type: 'MOVE_QUESTION', payload: { phaseId, stepId, fromIndex, toIndex } }), []);

  const selectBlock = useCallback((blockId: string | null, blockType: 'phase' | 'step' | 'question' | null) =>
    dispatch({ type: 'SELECT_BLOCK', payload: { blockId, blockType } }), []);

  const getSelectedBlock = useCallback((): ScriptBlock | null => {
    if (!state.selectedBlockId || !state.selectedBlockType) return null;

    for (const phase of state.phases) {
      if (phase.id === state.selectedBlockId) return phase;
      for (const step of phase.steps || []) {
        if (step.id === state.selectedBlockId) return step;
        for (const question of step.questions || []) {
          if (question.id === state.selectedBlockId) return question;
        }
      }
    }
    return null;
  }, [state.selectedBlockId, state.selectedBlockType, state.phases]);

  const updateInitialSection = useCallback((data: Partial<InitialSectionData>) =>
    dispatch({ type: 'UPDATE_INITIAL_SECTION', payload: data }), []);
  const updateFinalSection = useCallback((data: Partial<FinalSectionData>) =>
    dispatch({ type: 'UPDATE_FINAL_SECTION', payload: data }), []);

  const loadFromStructure = useCallback((structure: ScriptBlockStructure) =>
    dispatch({ type: 'LOAD_FROM_STRUCTURE', payload: structure }), []);

  const toStructure = useCallback((): ScriptBlockStructure => {
    return {
      metadata: {
        name: state.scriptName,
        type: state.scriptType,
        version: '1.0.0',
      },
      globalRules: [],
      phases: state.phases,
    };
  }, [state.scriptName, state.scriptType, state.phases]);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);
  const setIsDirty = useCallback((dirty: boolean) => dispatch({ type: 'SET_IS_DIRTY', payload: dirty }), []);
  const setIsLoading = useCallback((loading: boolean) => dispatch({ type: 'SET_IS_LOADING', payload: loading }), []);
  const setError = useCallback((error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }), []);

  const value = useMemo<BuilderContextValue>(() => ({
    ...state,
    setMode,
    setScriptType,
    setScriptName,
    setPhases,
    addPhase,
    updatePhase,
    deletePhase,
    movePhase,
    addStep,
    updateStep,
    deleteStep,
    moveStep,
    addQuestion,
    updateQuestion,
    deleteQuestion,
    moveQuestion,
    selectBlock,
    getSelectedBlock,
    updateInitialSection,
    updateFinalSection,
    loadFromStructure,
    toStructure,
    reset,
    setIsDirty,
    setIsLoading,
    setError,
  }), [
    state,
    setMode, setScriptType, setScriptName, setPhases,
    addPhase, updatePhase, deletePhase, movePhase,
    addStep, updateStep, deleteStep, moveStep,
    addQuestion, updateQuestion, deleteQuestion, moveQuestion,
    selectBlock, getSelectedBlock,
    updateInitialSection, updateFinalSection,
    loadFromStructure, toStructure, reset, setIsDirty, setIsLoading, setError,
  ]);

  return (
    <BuilderContext.Provider value={value}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilder() {
  const context = useContext(BuilderContext);
  if (!context) {
    throw new Error('useBuilder must be used within a BuilderProvider');
  }
  return context;
}