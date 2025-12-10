import { useState, useCallback, useEffect } from 'react';

export type ArchetypeId = 'analizzatore' | 'decisore' | 'amichevole' | 'scettico' | 'impaziente' | 'riflessivo' | 'esigente' | 'prudente' | 'neutral';
export type FeedbackPriority = 'critical' | 'high' | 'medium' | 'low';
export type FeedbackType = 'correction' | 'buy_signal' | 'objection' | 'checkpoint' | 'tone' | 'advancement' | 'out_of_scope' | 'control_loss';

export interface BuySignal {
  type: string;
  phrase: string;
  confidence: number;
  suggestedAction: string;
  timestamp: number;
}

export interface DetectedObjection {
  type: string;
  phrase: string;
  suggestedResponse: string;
  fromScript: boolean;
  timestamp: number;
}

export interface CheckpointItem {
  check: string;
  status: 'validated' | 'missing' | 'vague';
  infoCollected?: string;
  reason?: string;
}

export interface CheckpointStatus {
  checkpointId: string;
  checkpointName: string;
  isComplete: boolean;
  missingItems: string[];
  completedItems: string[];
  canAdvance: boolean;
  itemDetails?: CheckpointItem[];
  phaseNumber?: string;
}

export interface ProspectProfile {
  archetype: ArchetypeId;
  confidence: number;
  filler: string;
  instruction: string;
}

export interface CoachingFeedback {
  priority: FeedbackPriority;
  type: FeedbackType;
  message: string;
  toneReminder?: string;
  timestamp: number;
}

export interface ScriptProgress {
  currentPhaseId: string;
  currentPhaseName: string;
  currentStepId: string;
  currentStepName: string;
  phaseIndex: number;
  stepIndex: number;
  totalPhases: number;
  completionPercentage: number;
}

export interface ManagerAnalysis {
  analysisTimeMs: number;
  modelUsed: string;
  stepAdvancement: {
    shouldAdvance: boolean;
    nextPhaseId: string | null;
    nextStepId: string | null;
    confidence: number;
    reasoning: string;
  };
}

export interface SalesCoachingState {
  isActive: boolean;
  scriptProgress: ScriptProgress | null;
  buySignals: BuySignal[];
  objections: DetectedObjection[];
  checkpointStatus: CheckpointStatus | null;
  prospectProfile: ProspectProfile | null;
  currentFeedback: CoachingFeedback | null;
  feedbackHistory: CoachingFeedback[];
  toneWarnings: string[];
  managerAnalysis: ManagerAnalysis | null;
}

interface UseSalesCoachingOptions {
  isHost: boolean;
  onCoachingMessage?: (message: any) => void;
}

const initialState: SalesCoachingState = {
  isActive: false,
  scriptProgress: null,
  buySignals: [],
  objections: [],
  checkpointStatus: null,
  prospectProfile: null,
  currentFeedback: null,
  feedbackHistory: [],
  toneWarnings: [],
  managerAnalysis: null,
};

export function useSalesCoaching({ isHost, onCoachingMessage }: UseSalesCoachingOptions) {
  const [state, setState] = useState<SalesCoachingState>(initialState);

  const handleCoachingMessage = useCallback((message: any) => {
    const timestamp = Date.now();
    const data = message.data;

    switch (message.type) {
      case 'sales_coaching':
        setState(prev => ({
          ...prev,
          isActive: true,
          currentFeedback: {
            ...data,
            timestamp,
          },
          feedbackHistory: [
            { ...data, timestamp },
            ...prev.feedbackHistory.slice(0, 19),
          ],
        }));
        break;

      case 'buy_signal':
        setState(prev => ({
          ...prev,
          buySignals: [
            { ...data, timestamp },
            ...prev.buySignals.slice(0, 9),
          ],
        }));
        break;

      case 'objection_detected':
        setState(prev => ({
          ...prev,
          objections: [
            { ...data, timestamp },
            ...prev.objections.slice(0, 9),
          ],
        }));
        break;

      case 'checkpoint_status':
        setState(prev => ({
          ...prev,
          checkpointStatus: data,
        }));
        break;

      case 'prospect_profile':
        setState(prev => ({
          ...prev,
          prospectProfile: data,
        }));
        break;

      case 'tone_warning':
        setState(prev => ({
          ...prev,
          toneWarnings: [
            data.message,
            ...prev.toneWarnings.slice(0, 4),
          ],
        }));
        break;

      case 'script_progress_update':
        setState(prev => ({
          ...prev,
          scriptProgress: data,
        }));
        break;

      case 'coaching_session_start':
        setState(prev => ({
          ...prev,
          isActive: true,
        }));
        break;

      case 'coaching_session_end':
        setState(initialState);
        break;
    }

    // Handle prospect profile
    if (data.prospectProfile) {
      setState(prev => ({
        ...prev,
        prospectProfile: {
          archetype: data.prospectProfile.archetype,
          confidence: data.prospectProfile.confidence,
          instruction: data.prospectProfile.instruction || null,
        },
      }));
    }

    // Handle manager analysis (step advancement + reasoning)
    if (data.stepAdvancement || data.analysisTimeMs) {
      setState(prev => ({
        ...prev,
        managerAnalysis: {
          analysisTimeMs: data.analysisTimeMs || 0,
          modelUsed: data.modelUsed || 'unknown',
          stepAdvancement: {
            shouldAdvance: data.stepAdvancement?.shouldAdvance || false,
            nextPhaseId: data.stepAdvancement?.nextPhaseId || null,
            nextStepId: data.stepAdvancement?.nextStepId || null,
            confidence: data.stepAdvancement?.confidence || 0,
            reasoning: data.stepAdvancement?.reasoning || '',
          },
        },
      }));
    }


    if (onCoachingMessage) {
      onCoachingMessage(message);
    }
  }, [onCoachingMessage]);

  const dismissFeedback = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentFeedback: null,
    }));
  }, []);

  const dismissBuySignal = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      buySignals: prev.buySignals.filter((_, i) => i !== index),
    }));
  }, []);

  const dismissObjection = useCallback((index: number) => {
    setState(prev => ({
      ...prev,
      objections: prev.objections.filter((_, i) => i !== index),
    }));
  }, []);

  const clearToneWarnings = useCallback(() => {
    setState(prev => ({
      ...prev,
      toneWarnings: [],
    }));
  }, []);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return {
    ...state,
    handleCoachingMessage,
    dismissFeedback,
    dismissBuySignal,
    dismissObjection,
    clearToneWarnings,
    reset,
  };
}