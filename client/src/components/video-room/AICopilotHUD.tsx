import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical,
  CheckCircle2,
  Circle,
  Lightbulb,
  Shield,
  X,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

interface ScriptItem {
  id: string;
  text: string;
  completed: boolean;
}

interface AICopilotHUDProps {
  scriptItems: ScriptItem[];
  onToggleItem: (id: string) => void;
  currentSuggestion: string;
  battleCard: { objection: string; response: string } | null;
  onPresentBattleCard: () => void;
  onClose: () => void;
}

export default function AICopilotHUD({
  scriptItems,
  onToggleItem,
  currentSuggestion,
  battleCard,
  onPresentBattleCard,
  onClose,
}: AICopilotHUDProps) {
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [isScriptExpanded, setIsScriptExpanded] = useState(true);
  const [isSuggestionExpanded, setIsSuggestionExpanded] = useState(true);
  const hudRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-drag]')) return;
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  useEffect(() => {
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
  }, [isDragging, dragOffset]);

  const completedCount = scriptItems.filter((item) => item.completed).length;
  const progress = (completedCount / scriptItems.length) * 100;

  return (
    <motion.div
      ref={hudRef}
      initial={{ opacity: 0, scale: 0.9, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: -20 }}
      style={{ left: position.x, top: position.y }}
      className={`fixed w-80 bg-gray-900/95 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-2xl z-50 overflow-hidden ${
        isDragging ? 'cursor-grabbing' : 'cursor-grab'
      }`}
      onMouseDown={handleMouseDown}
    >
      <div className="bg-gradient-to-r from-purple-600/20 via-blue-600/20 to-cyan-600/20 p-3 flex items-center justify-between border-b border-gray-700/50">
        <div className="flex items-center gap-2">
          <GripVertical className="w-4 h-4 text-gray-500" />
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="text-white font-semibold text-sm">AI Copilot</span>
        </div>
        <Button
          data-no-drag
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-7 w-7 p-0 text-gray-400 hover:text-white hover:bg-gray-700/50"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="p-3 space-y-3 max-h-[60vh] overflow-y-auto">
        <div className="bg-gray-800/50 rounded-xl p-3">
          <button
            data-no-drag
            onClick={() => setIsScriptExpanded(!isScriptExpanded)}
            className="flex items-center justify-between w-full mb-2"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-white font-medium text-sm">Script Checklist</span>
              <span className="text-xs text-gray-400">
                {completedCount}/{scriptItems.length}
              </span>
            </div>
            {isScriptExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <div className="mb-2">
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          <AnimatePresence>
            {isScriptExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="space-y-2 overflow-hidden"
              >
                {scriptItems.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ x: -10, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    className="flex items-center gap-2 group"
                  >
                    <div data-no-drag>
                      <Checkbox
                        checked={item.completed}
                        onCheckedChange={() => onToggleItem(item.id)}
                        className="border-gray-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                      />
                    </div>
                    <span
                      className={`text-sm transition-all ${
                        item.completed
                          ? 'text-gray-500 line-through'
                          : 'text-gray-300 group-hover:text-white'
                      }`}
                    >
                      {item.text}
                    </span>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="bg-gradient-to-br from-blue-900/30 to-cyan-900/30 rounded-xl p-3 border border-blue-500/20">
          <button
            data-no-drag
            onClick={() => setIsSuggestionExpanded(!isSuggestionExpanded)}
            className="flex items-center justify-between w-full mb-2"
          >
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-medium text-sm">Suggerimento AI</span>
            </div>
            {isSuggestionExpanded ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>

          <AnimatePresence>
            {isSuggestionExpanded && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <p className="text-sm text-blue-200 leading-relaxed">{currentSuggestion}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <AnimatePresence>
          {battleCard && (
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -20, opacity: 0, scale: 0.95 }}
              className="bg-gradient-to-br from-red-900/40 to-orange-900/40 rounded-xl p-3 border border-red-500/30"
            >
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-red-400" />
                <span className="text-white font-medium text-sm">Battle Card</span>
                <span className="px-2 py-0.5 bg-red-500/30 text-red-300 text-xs rounded-full">
                  Obiezione
                </span>
              </div>

              <div className="space-y-2">
                <div className="bg-red-950/50 rounded-lg p-2">
                  <p className="text-xs text-red-300 font-medium mb-1">Obiezione rilevata:</p>
                  <p className="text-sm text-red-200">"{battleCard.objection}"</p>
                </div>

                <div className="bg-green-950/50 rounded-lg p-2">
                  <p className="text-xs text-green-300 font-medium mb-1">Risposta suggerita:</p>
                  <p className="text-sm text-green-200">{battleCard.response}</p>
                </div>

                <Button
                  data-no-drag
                  onClick={onPresentBattleCard}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white"
                  size="sm"
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Presenta Risposta
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
