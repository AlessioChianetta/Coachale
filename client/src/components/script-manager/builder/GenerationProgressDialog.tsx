import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Sparkles, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  Clock,
  MessageSquare,
  Layers,
  AlertTriangle,
  CheckCheck,
  Timer,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export type PhaseStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

export interface PhaseInfo {
  index: number;
  name: string;
  number: string;
  stepsCount: number;
  hasCheckpoint: boolean;
  status: PhaseStatus;
  stats?: {
    stepsModified: number;
    totalSteps: number;
    questionsModified: number;
    timeMs: number;
  };
  error?: string;
}

export interface GenerationProgress {
  isOpen: boolean;
  status: 'connecting' | 'generating' | 'completed' | 'error';
  totalPhases: number;
  currentPhaseIndex: number;
  phases: PhaseInfo[];
  completedCount: number;
  failedCount: number;
  totalTimeMs: number;
  errorMessage?: string;
}

interface GenerationProgressDialogProps {
  progress: GenerationProgress;
  onClose: () => void;
  onComplete: () => void;
}

const PHASE_ICONS: Record<string, string> = {
  'APERTURA': '👋',
  'PAIN POINT': '🎯',
  'INFO PERSONALI': '📋',
  'INQUISITORIO': '🔍',
  'STRETCH THE GAP': '📈',
  'QUALIFICAZIONE': '✅',
  'SERIETÀ': '💰',
  'CHIUSURA': '🤝',
};

function getPhaseIcon(phaseName: string): string {
  for (const [key, icon] of Object.entries(PHASE_ICONS)) {
    if (phaseName.toUpperCase().includes(key)) {
      return icon;
    }
  }
  return '📌';
}

function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function PhaseItem({ phase, isLast }: { phase: PhaseInfo; isLast: boolean }) {
  const statusConfig = {
    pending: {
      icon: <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />,
      bg: 'bg-muted/30',
      border: 'border-muted',
      text: 'text-muted-foreground',
    },
    in_progress: {
      icon: <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />,
      bg: 'bg-purple-50 dark:bg-purple-950/30',
      border: 'border-purple-400',
      text: 'text-purple-700 dark:text-purple-300',
    },
    completed: {
      icon: <CheckCircle2 className="w-4 h-4 text-green-600" />,
      bg: 'bg-green-50 dark:bg-green-950/30',
      border: 'border-green-400',
      text: 'text-green-700 dark:text-green-300',
    },
    failed: {
      icon: <XCircle className="w-4 h-4 text-red-600" />,
      bg: 'bg-red-50 dark:bg-red-950/30',
      border: 'border-red-400',
      text: 'text-red-700 dark:text-red-300',
    },
  };

  const config = statusConfig[phase.status];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: phase.index * 0.05 }}
      className="relative"
    >
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${config.border} ${config.bg}`}>
            {config.icon}
          </div>
          {!isLast && (
            <div className={`w-0.5 h-8 ${phase.status === 'completed' ? 'bg-green-300' : 'bg-muted'}`} />
          )}
        </div>
        
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-2">
            <span className="text-lg">{getPhaseIcon(phase.name)}</span>
            <span className={`font-medium text-sm ${config.text}`}>
              Fase {phase.number}: {phase.name}
            </span>
            {phase.hasCheckpoint && (
              <Badge variant="outline" className="text-xs py-0 px-1.5 h-5">
                <CheckCheck className="w-3 h-3 mr-1" />
                Checkpoint
              </Badge>
            )}
          </div>
          
          {phase.status === 'in_progress' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex items-center gap-2 text-xs text-purple-600"
            >
              <Zap className="w-3 h-3 animate-pulse" />
              <span>Personalizzazione in corso con AI...</span>
            </motion.div>
          )}
          
          {phase.status === 'completed' && phase.stats && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground"
            >
              <span className="flex items-center gap-1">
                <Layers className="w-3 h-3" />
                {phase.stats.stepsModified}/{phase.stats.totalSteps} steps
              </span>
              <span className="flex items-center gap-1">
                <MessageSquare className="w-3 h-3" />
                {phase.stats.questionsModified} domande
              </span>
              <span className="flex items-center gap-1">
                <Timer className="w-3 h-3" />
                {formatTime(phase.stats.timeMs)}
              </span>
            </motion.div>
          )}
          
          {phase.status === 'failed' && phase.error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-2 flex items-start gap-2 text-xs text-red-600"
            >
              <AlertTriangle className="w-3 h-3 mt-0.5" />
              <span>{phase.error}</span>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function GenerationProgressDialog({
  progress,
  onClose,
  onComplete,
}: GenerationProgressDialogProps) {
  const progressPercent = progress.totalPhases > 0
    ? Math.round(((progress.completedCount + progress.failedCount) / progress.totalPhases) * 100)
    : 0;

  const isFinished = progress.status === 'completed' || progress.status === 'error';

  return (
    <Dialog open={progress.isOpen} onOpenChange={(open) => !open && isFinished && onClose()}>
      <DialogContent className="max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {progress.status === 'generating' && (
              <>
                <Sparkles className="h-5 w-5 text-purple-600 animate-pulse" />
                Generazione AI in corso...
              </>
            )}
            {progress.status === 'completed' && (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Generazione completata!
              </>
            )}
            {progress.status === 'error' && (
              <>
                <XCircle className="h-5 w-5 text-red-600" />
                Generazione fallita
              </>
            )}
            {progress.status === 'connecting' && (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-purple-600" />
                Connessione...
              </>
            )}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {progress.status === 'generating' && (
              <span>Fase {progress.currentPhaseIndex + 1} di {progress.totalPhases}</span>
            )}
            {progress.status === 'completed' && (
              <span>{progress.completedCount} fasi completate in {formatTime(progress.totalTimeMs)}</span>
            )}
            {progress.status === 'error' && (
              <span>Errore durante la generazione</span>
            )}
            {progress.status === 'connecting' && (
              <span>Preparazione della generazione...</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <div className="flex items-center gap-3 mb-2">
            <Progress value={progressPercent} className="flex-1 h-2" />
            <span className="text-sm font-medium text-muted-foreground w-12 text-right">
              {progressPercent}%
            </span>
          </div>
          
          <div className="flex justify-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />
              {progress.completedCount} completate
            </span>
            {progress.failedCount > 0 && (
              <span className="flex items-center gap-1">
                <XCircle className="w-3.5 h-3.5 text-red-600" />
                {progress.failedCount} fallite
              </span>
            )}
            <span className="flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              {progress.totalPhases} totali
            </span>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-hidden">
          <ScrollArea className="h-full max-h-[40vh]">
            <div className="py-2 pr-4">
              <AnimatePresence mode="popLayout">
                {progress.phases.map((phase, idx) => (
                  <PhaseItem 
                    key={phase.index} 
                    phase={phase} 
                    isLast={idx === progress.phases.length - 1}
                  />
                ))}
              </AnimatePresence>
            </div>
          </ScrollArea>
        </div>

        {progress.errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {progress.errorMessage}
            </p>
          </div>
        )}

        <DialogFooter className="pt-2">
          {isFinished ? (
            <Button onClick={progress.status === 'completed' ? onComplete : onClose}>
              {progress.status === 'completed' ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Apri Script Builder
                </>
              ) : (
                'Chiudi'
              )}
            </Button>
          ) : (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Generazione in corso...
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
