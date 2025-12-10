import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Brain, 
  Target, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle, 
  XCircle, 
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Lightbulb,
  MessageSquare,
  User,
  Volume2,
  FileText,
  Mic
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SalesCoachingState, ArchetypeId } from './hooks/useSalesCoaching';

interface TranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
}

interface CoachingPanelProps {
  coaching: SalesCoachingState;
  transcript: TranscriptEntry[];
  myParticipantId: string | null;
  onDismissFeedback: () => void;
  onDismissBuySignal: (index: number) => void;
  onDismissObjection: (index: number) => void;
  onClose: () => void;
}

const ARCHETYPE_LABELS: Record<ArchetypeId, { label: string; emoji: string; color: string }> = {
  analizzatore: { label: 'Analizzatore', emoji: '🔍', color: 'text-blue-400' },
  decisore: { label: 'Decisore', emoji: '⚡', color: 'text-yellow-400' },
  amichevole: { label: 'Amichevole', emoji: '😊', color: 'text-green-400' },
  scettico: { label: 'Scettico', emoji: '🤔', color: 'text-orange-400' },
  impaziente: { label: 'Impaziente', emoji: '⏱️', color: 'text-red-400' },
  riflessivo: { label: 'Riflessivo', emoji: '💭', color: 'text-purple-400' },
  esigente: { label: 'Esigente', emoji: '👔', color: 'text-indigo-400' },
  prudente: { label: 'Prudente', emoji: '🛡️', color: 'text-cyan-400' },
  neutral: { label: 'Neutro', emoji: '😐', color: 'text-gray-400' },
};

const PRIORITY_STYLES = {
  critical: 'bg-red-500/20 border-red-500/50 text-red-300',
  high: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
  medium: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  low: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
};

export default function CoachingPanel({
  coaching,
  transcript,
  myParticipantId,
  onDismissFeedback,
  onDismissBuySignal,
  onDismissObjection,
  onClose,
}: CoachingPanelProps) {
  const [isTranscriptExpanded, setIsTranscriptExpanded] = useState(false);
  const [isFloating, setIsFloating] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 340, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const { 
    scriptProgress, 
    buySignals, 
    objections, 
    checkpointStatus, 
    prospectProfile,
    currentFeedback,
    toneWarnings,
  } = coaching;

  useEffect(() => {
    if (isTranscriptExpanded && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, isTranscriptExpanded]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isFloating) return;
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
    if (!isFloating) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const newX = Math.max(0, Math.min(window.innerWidth - 320, e.clientX - dragOffset.x));
      const newY = Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragOffset.y));
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isFloating, isDragging, dragOffset]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isFloating ? 50 : 320 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: isFloating ? 50 : 320 }}
      style={isFloating ? { left: position.x, top: position.y } : undefined}
      onMouseDown={handleMouseDown}
      className={cn(
        "w-80 bg-gray-900/95 backdrop-blur-md border border-gray-700/50 overflow-y-auto",
        isFloating 
          ? "fixed rounded-2xl shadow-2xl max-h-[80vh] z-50" + (isDragging ? " cursor-grabbing" : " cursor-grab")
          : "fixed right-0 top-0 h-full border-l z-30"
      )}
    >
      <div className="sticky top-0 bg-gray-900/95 backdrop-blur-md z-10 p-3 border-b border-gray-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            <h2 className="text-white font-semibold text-sm">Sales Coach</h2>
          </div>
          <div className="flex items-center gap-1" data-no-drag>
            <button
              onClick={() => setIsFloating(!isFloating)}
              className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
              title={isFloating ? "Ancora al lato" : "Rendi fluttuante"}
            >
              {isFloating ? (
                <div className="w-4 h-4 text-cyan-400">📌</div>
              ) : (
                <div className="w-4 h-4 text-gray-400">🔓</div>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {scriptProgress && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-4 h-4 text-purple-400" />
              <span className="text-xs text-gray-400">Fase Corrente</span>
            </div>
            <p className="text-white text-sm font-medium mb-2">
              {scriptProgress.currentPhaseName}
            </p>
            <p className="text-gray-400 text-xs mb-2">
              Step: {scriptProgress.currentStepName}
            </p>
            <div className="w-full bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-purple-500 h-1.5 rounded-full transition-all"
                style={{ width: `${scriptProgress.completionPercentage}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {scriptProgress.completionPercentage}% completato
            </p>
          </div>
        )}

        {prospectProfile && prospectProfile.archetype !== 'neutral' && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-cyan-400" />
              <span className="text-xs text-gray-400">Archetipo Prospect</span>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xl">
                {ARCHETYPE_LABELS[prospectProfile.archetype]?.emoji}
              </span>
              <span className={cn("font-semibold", ARCHETYPE_LABELS[prospectProfile.archetype]?.color)}>
                {ARCHETYPE_LABELS[prospectProfile.archetype]?.label}
              </span>
              <span className="text-xs text-gray-500">
                {Math.round(prospectProfile.confidence * 100)}%
              </span>
            </div>
            {prospectProfile.instruction && (
              <p className="text-xs text-gray-300 bg-gray-700/50 p-2 rounded">
                💡 {prospectProfile.instruction}
              </p>
            )}
          </div>
        )}

        {/* Sezione Trascrizione Collapsible */}
        <div className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden">
          <button
            onClick={() => setIsTranscriptExpanded(!isTranscriptExpanded)}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-700/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span className="text-xs text-gray-400">Trascrizione</span>
              <span className="text-xs text-gray-500">({transcript.length} msg)</span>
            </div>
            {isTranscriptExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          
          <AnimatePresence>
            {isTranscriptExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="border-t border-gray-700/50"
              >
                <div className="max-h-48 overflow-y-auto p-2 space-y-2">
                  {transcript.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">
                      In attesa della trascrizione...
                    </p>
                  ) : (
                    transcript.map((msg, idx) => {
                      const role = (msg as any).role || '';
                      const isHost = msg.speakerId === myParticipantId || 
                        msg.speakerId === 'assistant' || 
                        role === 'assistant';
                      const displayName = msg.speakerName || (isHost ? 'Host' : 'Prospect');
                      const displayText = msg.text || (msg as any).content || '';
                      
                      if (!displayText) return null;
                      
                      return (
                        <div key={idx} className="flex gap-2">
                          <div className={cn(
                            "flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center",
                            isHost 
                              ? "bg-purple-500/20" 
                              : "bg-blue-500/20"
                          )}>
                            {isHost ? (
                              <Mic className="w-3 h-3 text-purple-400" />
                            ) : (
                              <User className="w-3 h-3 text-blue-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn(
                              "text-xs font-medium",
                              isHost ? "text-purple-300" : "text-blue-300"
                            )}>
                              {displayName}
                            </p>
                            <p className="text-xs text-gray-300 break-words">
                              {displayText}
                            </p>
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={transcriptEndRef} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {currentFeedback && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={cn(
                "rounded-lg p-3 border",
                PRIORITY_STYLES[currentFeedback.priority]
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4" />
                  <span className="text-xs font-medium uppercase">
                    {currentFeedback.priority === 'critical' ? '🚨 Urgente' : 'Suggerimento'}
                  </span>
                </div>
                <button
                  onClick={onDismissFeedback}
                  className="p-0.5 hover:bg-white/10 rounded"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
              <p className="text-sm">{currentFeedback.message}</p>
              {currentFeedback.toneReminder && (
                <p className="text-xs mt-2 opacity-75">
                  🎭 {currentFeedback.toneReminder}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {buySignals.length > 0 && (
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="bg-green-500/20 rounded-lg p-3 border border-green-500/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-green-300 text-xs font-medium">
                  💰 SEGNALE D'ACQUISTO!
                </span>
              </div>
              {buySignals.slice(0, 3).map((signal, i) => (
                <div key={i} className="mb-2 last:mb-0">
                  <p className="text-green-200 text-sm italic">"{signal.phrase}"</p>
                  <p className="text-green-300/80 text-xs mt-1">
                    📝 {signal.suggestedAction}
                  </p>
                  <button
                    onClick={() => onDismissBuySignal(i)}
                    className="text-xs text-green-400/60 hover:text-green-400 mt-1"
                  >
                    Nascondi
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {objections.length > 0 && (
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="bg-red-500/20 rounded-lg p-3 border border-red-500/50"
            >
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-red-300 text-xs font-medium">
                  🛡️ OBIEZIONE RILEVATA
                </span>
              </div>
              {objections.slice(0, 2).map((obj, i) => (
                <div key={i} className="mb-3 last:mb-0 bg-gray-800/50 rounded p-2">
                  <p className="text-red-200 text-sm italic">"{obj.phrase}"</p>
                  <div className="mt-2 bg-gray-700/50 rounded p-2">
                    <p className="text-xs text-gray-400 mb-1">
                      {obj.fromScript ? '📜 Risposta dallo script:' : '💡 Suggerimento:'}
                    </p>
                    <p className="text-gray-200 text-sm">{obj.suggestedResponse}</p>
                  </div>
                  <button
                    onClick={() => onDismissObjection(i)}
                    className="text-xs text-red-400/60 hover:text-red-400 mt-2"
                  >
                    Nascondi
                  </button>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {checkpointStatus && (
          <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="w-4 h-4 text-blue-400" />
              <span className="text-xs text-gray-400">
                Checkpoint: {checkpointStatus.checkpointName}
              </span>
            </div>
            <div className="space-y-1.5">
              {checkpointStatus.itemDetails?.map((item, i) => (
                <div key={i} className="flex items-start gap-2">
                  {item.status === 'validated' ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400 mt-0.5 shrink-0" />
                  ) : item.status === 'vague' ? (
                    <Clock className="w-3.5 h-3.5 text-yellow-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-gray-500 mt-0.5 shrink-0" />
                  )}
                  <span className={cn(
                    "text-xs",
                    item.status === 'validated' ? 'text-green-300' :
                    item.status === 'vague' ? 'text-yellow-300' : 'text-gray-500'
                  )}>
                    {item.check}
                  </span>
                </div>
              ))}
            </div>
            {checkpointStatus.canAdvance && (
              <div className="mt-2 flex items-center gap-1 text-green-400 text-xs">
                <ChevronRight className="w-3 h-3" />
                Puoi avanzare alla fase successiva
              </div>
            )}
          </div>
        )}

        {toneWarnings.length > 0 && (
          <div className="bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/30">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-300 text-xs font-medium">
                Promemoria Tono
              </span>
            </div>
            {toneWarnings.slice(0, 2).map((warning, i) => (
              <p key={i} className="text-yellow-200/80 text-xs mb-1">
                • {warning}
              </p>
            ))}
          </div>
        )}

        {!coaching.isActive && (
          <div className="text-center py-8">
            <Brain className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 text-sm">
              Il coaching si attiverà quando inizierà la conversazione
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
