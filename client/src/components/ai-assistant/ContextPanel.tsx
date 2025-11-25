import { motion, AnimatePresence } from "framer-motion";
import { X, BookOpen, FileText, Sparkles, List, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageContext } from "@/hooks/use-page-context";

interface ContextPanelProps {
  isOpen: boolean;
  onClose: () => void;
  pageContext: PageContext;
  onOpenMainAI: () => void;
}

export function ContextPanel({ isOpen, onClose, pageContext, onOpenMainAI }: ContextPanelProps) {
  const isExercise = pageContext.pageType === "exercise";
  const isExercisesList = pageContext.pageType === "exercises_list";
  const isUniversity = pageContext.pageType === "course";
  const isLesson = pageContext.pageType === "library_document" || pageContext.pageType === "university_lesson";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, x: -400 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -400 }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed bottom-6 left-6 z-40 w-[380px]"
        >
          <Card className="w-full shadow-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <CardHeader className="bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 border-b border-gray-200 dark:border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-full ${
                    isExercise ? 'bg-gradient-to-br from-purple-500 to-purple-600' : 
                    isExercisesList ? 'bg-gradient-to-br from-indigo-500 to-indigo-600' :
                    isUniversity ? 'bg-gradient-to-br from-cyan-500 to-cyan-600' :
                    'bg-gradient-to-br from-blue-500 to-blue-600'
                  } flex items-center justify-center`}>
                    {isExercise ? (
                      <FileText className="h-4 w-4 text-white" />
                    ) : isExercisesList ? (
                      <List className="h-4 w-4 text-white" />
                    ) : isUniversity ? (
                      <GraduationCap className="h-4 w-4 text-white" />
                    ) : (
                      <BookOpen className="h-4 w-4 text-white" />
                    )}
                  </div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Contesto Rilevato
                  </h2>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-800 h-7 w-7"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-5">
              {isExercisesList ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-indigo-200 dark:from-indigo-900/40 dark:to-indigo-800/40 flex items-center justify-center">
                      <List className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                  </div>
                  <Badge variant="outline" className="mb-3 text-xs bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200">
                    📋 Lista Esercizi
                  </Badge>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Stai visualizzando:
                  </h3>
                  <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-3 mb-4 border border-indigo-100 dark:border-indigo-800">
                    <p className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm">
                      Panoramica Esercizi
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                    L'AI Assistant può aiutarti con:
                  </p>
                  <div className="text-xs space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Consigli su quale esercizio iniziare</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Strategie di studio</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Gestione delle scadenze</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Analisi dei tuoi progressi</span>
                    </div>
                  </div>
                </>
              ) : isUniversity ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-100 to-cyan-200 dark:from-cyan-900/40 dark:to-cyan-800/40 flex items-center justify-center">
                      <GraduationCap className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                  </div>
                  <Badge variant="outline" className="mb-3 text-xs bg-cyan-50 dark:bg-cyan-900/30 border-cyan-200">
                    🎓 Università
                  </Badge>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Stai visualizzando:
                  </h3>
                  <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3 mb-4 border border-cyan-100 dark:border-cyan-800">
                    <p className="font-semibold text-cyan-900 dark:text-cyan-100 text-sm">
                      Panoramica Università
                    </p>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                    L'AI Assistant può aiutarti con:
                  </p>
                  <div className="text-xs space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Pianificare il percorso di studio</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Spiegare la struttura del corso</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Preparazione agli esami</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Monitorare progressi e certificati</span>
                    </div>
                  </div>
                </>
              ) : isLesson ? (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 flex items-center justify-center">
                      <BookOpen className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                  </div>
                  <Badge variant="outline" className="mb-3 text-xs bg-blue-50 dark:bg-blue-900/30 border-blue-200">
                    {pageContext.pageType === "library_document" ? "📚 Libreria" : "🎓 Università"}
                  </Badge>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Stai studiando:
                  </h3>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 mb-4 border border-blue-100 dark:border-blue-800">
                    <p className="font-semibold text-blue-900 dark:text-blue-100 text-sm mb-1">
                      "{pageContext.resourceTitle || "Questa lezione"}"
                    </p>
                    {pageContext.additionalContext?.categoryName && (
                      <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        📂 {pageContext.additionalContext.categoryName}
                        {pageContext.additionalContext.level && ` • ${pageContext.additionalContext.level}`}
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                    L'AI Assistant può aiutarti con:
                  </p>
                  <div className="text-xs space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Spiegare i concetti chiave</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Fare un riassunto</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Rispondere a domande specifiche</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Suggerirti esercizi correlati</span>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/40 dark:to-purple-800/40 flex items-center justify-center">
                      <FileText className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                  </div>
                  <Badge variant="outline" className="mb-3 text-xs bg-purple-50 dark:bg-purple-900/30 border-purple-200">
                    📝 Esercizio
                  </Badge>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    Stai lavorando su:
                  </h3>
                  <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 mb-4 border border-purple-100 dark:border-purple-800">
                    <p className="font-semibold text-purple-900 dark:text-purple-100 text-sm mb-1">
                      "{pageContext.resourceTitle || "Questo esercizio"}"
                    </p>
                    {pageContext.additionalContext?.status && (
                      <Badge className="mt-2 text-xs" variant={
                        pageContext.additionalContext.status === 'completed' ? 'default' : 'secondary'
                      }>
                        {pageContext.additionalContext.status}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 font-medium">
                    L'AI Assistant ti può aiutare con:
                  </p>
                  <div className="text-xs space-y-1.5 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-3 mb-4">
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Guidarti passo-passo</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Chiarire le domande</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Rivedere le tue risposte</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400 mt-0.5">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Suggerire risorse utili</span>
                    </div>
                  </div>
                </>
              )}

              <Button
                onClick={onOpenMainAI}
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                Apri AI Assistant
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
