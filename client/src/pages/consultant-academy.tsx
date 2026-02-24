import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuiddePlayer } from "@/components/academy/GuiddePlayer";
import { ACADEMY_MODULES, ACADEMY_LESSONS_FLAT, LESSON_BY_ID, type AcademyLesson } from "@/data/academy-curriculum";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ChevronDown, ChevronRight, ExternalLink,
  ArrowLeft, ArrowRight, GraduationCap, Settings, Clock,
  ChevronUp,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

const MODULE_COLORS: Record<string, string> = {
  setup_base: "from-slate-500 to-slate-700",
  acquisisci_lead: "from-blue-500 to-blue-700",
  vendi_converti: "from-violet-500 to-purple-700",
  automazioni_ai: "from-indigo-500 to-blue-700",
  contenuti_corsi: "from-amber-500 to-orange-600",
  avanzato: "from-rose-500 to-red-700",
};

const MODULE_BADGE_COLORS: Record<string, string> = {
  setup_base: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  acquisisci_lead: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  vendi_converti: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  automazioni_ai: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  contenuti_corsi: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  avanzato: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
};

interface StepStatusEntry {
  stepId: string;
  status: "pending" | "configured" | "verified" | "error" | "skipped";
}

function useAcademyData() {
  const queryClient = useQueryClient();

  const { data: wizardData } = useQuery<{ success: boolean; data: StepStatusEntry[] }>({
    queryKey: ["/api/consultant/onboarding/status/for-ai"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/status/for-ai", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch wizard status");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: manualData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/consultant/academy/completions"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/academy/completions", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch academy completions");
      return res.json();
    },
    staleTime: 30_000,
  });

  const wizardCompleted = useMemo(() => {
    const set = new Set<string>();
    for (const entry of wizardData?.data ?? []) {
      if (entry.status === "verified") set.add(entry.stepId);
    }
    return set;
  }, [wizardData]);

  const manualCompleted = useMemo(
    () => new Set<string>(manualData?.data ?? []),
    [manualData]
  );

  const allCompleted = useMemo(
    () => new Set([...wizardCompleted, ...manualCompleted]),
    [wizardCompleted, manualCompleted]
  );

  const markMutation = useMutation({
    mutationFn: async ({ stepId, done }: { stepId: string; done: boolean }) => {
      const res = await fetch(`/api/consultant/academy/completions/${stepId}`, {
        method: done ? "POST" : "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to update completion");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/academy/completions"] });
    },
  });

  return { wizardCompleted, manualCompleted, allCompleted, markMutation };
}

function LessonSidebarItem({
  lesson,
  isActive,
  isCompleted,
  isWizardDone,
  onClick,
}: {
  lesson: AcademyLesson;
  isActive: boolean;
  isCompleted: boolean;
  isWizardDone: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all group",
        isActive
          ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-700"
          : "hover:bg-muted/60"
      )}
    >
      <div className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        ) : (
          <div className={cn(
            "w-4 h-4 rounded-full border-2 transition-colors",
            isActive
              ? "border-indigo-500"
              : "border-muted-foreground/30 group-hover:border-indigo-400"
          )} />
        )}
      </div>
      <span className={cn(
        "text-sm flex-1 leading-tight",
        isActive ? "font-semibold text-indigo-700 dark:text-indigo-300" : "text-foreground",
        isCompleted && !isActive && "text-muted-foreground line-through decoration-muted-foreground/40"
      )}>
        {lesson.title}
      </span>
      {isWizardDone && !isActive && (
        <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded-full flex-shrink-0">
          Setup ✓
        </span>
      )}
      <span className="text-[10px] text-muted-foreground flex-shrink-0 flex items-center gap-0.5">
        <Clock className="w-2.5 h-2.5" />
        {lesson.duration}
      </span>
    </button>
  );
}

function ModuleAccordion({
  module,
  completedIds,
  wizardCompleted,
  activeId,
  onSelect,
}: {
  module: typeof ACADEMY_MODULES[0];
  completedIds: Set<string>;
  wizardCompleted: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const completedInModule = module.lessons.filter(l => completedIds.has(l.id)).length;
  const isAnyActive = module.lessons.some(l => l.id === activeId);
  const [open, setOpen] = useState(isAnyActive);

  useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  const gradientClass = MODULE_COLORS[module.id] ?? "from-slate-500 to-slate-700";

  return (
    <div className="rounded-2xl overflow-hidden border border-border/60 bg-card/50 shadow-sm">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors"
      >
        <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center text-base bg-gradient-to-br flex-shrink-0 shadow-sm", gradientClass)}>
          {module.emoji}
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">{module.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {completedInModule}/{module.lessons.length} completate
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {completedInModule === module.lessons.length && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          )}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-2 pb-2 space-y-0.5">
              {module.lessons.map(lesson => (
                <LessonSidebarItem
                  key={lesson.id}
                  lesson={lesson}
                  isActive={lesson.id === activeId}
                  isCompleted={completedIds.has(lesson.id)}
                  isWizardDone={wizardCompleted.has(lesson.id)}
                  onClick={() => onSelect(lesson.id)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LessonDetail({
  lesson,
  isCompleted,
  isWizardDone,
  onToggleComplete,
  isToggling,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  lesson: AcademyLesson;
  isCompleted: boolean;
  isWizardDone: boolean;
  onToggleComplete: () => void;
  isToggling: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
  const module = ACADEMY_MODULES.find(m => m.id === lesson.moduleId);
  const badgeClass = MODULE_BADGE_COLORS[lesson.moduleId] ?? "";
  const gradientClass = MODULE_COLORS[lesson.moduleId] ?? "from-slate-500 to-slate-700";

  return (
    <div className="flex flex-col gap-6">
      <GuiddePlayer embedUrl={lesson.guiddeEmbedUrl} title={lesson.title} />

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className={cn("h-1 bg-gradient-to-r", gradientClass)} />
        <div className="p-5 md:p-6 space-y-4">
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {module && (
                  <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", badgeClass)}>
                    {module.emoji} {module.title}
                  </span>
                )}
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {lesson.duration}
                </span>
                <span className="text-xs text-muted-foreground">
                  Lezione {lesson.stepNumber}/27
                </span>
              </div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground leading-tight">
                {lesson.title}
              </h1>
            </div>

            {isWizardDone && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex-shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                  Configurato nel Setup
                </span>
              </div>
            )}
          </div>

          <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
            {lesson.description}
          </p>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Link href={lesson.configLink}>
              <Button variant="outline" size="sm" className="gap-2 w-full sm:w-auto">
                <Settings className="w-4 h-4" />
                Vai alla configurazione
                <ExternalLink className="w-3 h-3 opacity-60" />
              </Button>
            </Link>

            {!isWizardDone && (
              <Button
                size="sm"
                onClick={onToggleComplete}
                disabled={isToggling}
                className={cn(
                  "gap-2 w-full sm:w-auto transition-colors",
                  isCompleted
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white"
                )}
              >
                <CheckCircle2 className="w-4 h-4" />
                {isCompleted ? "Lezione completata ✓" : "Segna come completata"}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={onPrev}
          disabled={!hasPrev}
          className="gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Precedente</span>
        </Button>

        <div className="text-xs text-muted-foreground text-center">
          Lezione {lesson.stepNumber} di 27
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={onNext}
          disabled={!hasNext}
          className="gap-2"
        >
          <span className="hidden sm:inline">Successiva</span>
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export default function ConsultantAcademy() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { toast } = useToast();
  const { wizardCompleted, manualCompleted, allCompleted, markMutation } = useAcademyData();

  const initialStepId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    if (step && LESSON_BY_ID[step]) return step;
    return ACADEMY_LESSONS_FLAT[0].id;
  }, []);

  const [activeId, setActiveId] = useState<string>(initialStepId);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeLesson = LESSON_BY_ID[activeId] ?? ACADEMY_LESSONS_FLAT[0];
  const activeIndex = ACADEMY_LESSONS_FLAT.findIndex(l => l.id === activeId);
  const prevLesson = activeIndex > 0 ? ACADEMY_LESSONS_FLAT[activeIndex - 1] : null;
  const nextLesson = activeIndex < ACADEMY_LESSONS_FLAT.length - 1 ? ACADEMY_LESSONS_FLAT[activeIndex + 1] : null;

  const totalCompleted = allCompleted.size;
  const progressPct = Math.round((totalCompleted / 27) * 100);

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setMobileSidebarOpen(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handleToggleComplete = useCallback(async () => {
    const isCurrentlyCompleted = manualCompleted.has(activeId);
    try {
      await markMutation.mutateAsync({ stepId: activeId, done: !isCurrentlyCompleted });
      toast({
        title: isCurrentlyCompleted ? "Lezione rimossa" : "Lezione completata!",
        description: isCurrentlyCompleted
          ? "Hai rimosso il completamento manuale."
          : "Ottimo lavoro! Continua così.",
      });
    } catch {
      toast({ title: "Errore", description: "Riprova tra poco.", variant: "destructive" });
    }
  }, [activeId, manualCompleted, markMutation, toast]);

  const isCompleted = allCompleted.has(activeId);
  const isWizardDone = wizardCompleted.has(activeId);

  const sidebarContent = (
    <div className="flex flex-col gap-3">
      <div className="space-y-1 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{totalCompleted}/27 lezioni</span>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{progressPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {totalCompleted === 27 ? "🎉 Corso completato!" : `Ancora ${27 - totalCompleted} da completare`}
        </p>
      </div>

      <div className="space-y-2">
        {ACADEMY_MODULES.map(mod => (
          <ModuleAccordion
            key={mod.id}
            module={mod}
            completedIds={allCompleted}
            wizardCompleted={wizardCompleted}
            activeId={activeId}
            onSelect={handleSelect}
          />
        ))}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 md:py-8">
            <div className="mb-6 md:mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-md">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl md:text-2xl font-bold text-foreground">Accademia di Formazione</h1>
                  <p className="text-sm text-muted-foreground">27 lezioni per padroneggiare la piattaforma</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2">
                  <div className="w-32 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{progressPct}%</span>
                </div>

                <Link href="/consultant/setup-wizard">
                  <Button variant="outline" size="sm" className="gap-2 text-xs">
                    <Settings className="w-3.5 h-3.5" />
                    Setup Wizard
                    <ChevronRight className="w-3 h-3 opacity-60" />
                  </Button>
                </Link>
              </div>
            </div>

            {isMobile && (
              <div className="mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 justify-between"
                  onClick={() => setMobileSidebarOpen(p => !p)}
                >
                  <span className="flex items-center gap-2">
                    <span>{ACADEMY_MODULES.find(m => m.id === activeLesson.moduleId)?.emoji}</span>
                    <span className="text-sm font-medium truncate">{activeLesson.title}</span>
                  </span>
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-xs">{totalCompleted}/27</Badge>
                    {mobileSidebarOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </span>
                </Button>

                <AnimatePresence>
                  {mobileSidebarOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden mt-2 rounded-2xl border border-border/60 bg-card shadow-lg"
                    >
                      <div className="p-3">
                        {sidebarContent}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            <div className="flex gap-6 lg:gap-8">
              {!isMobile && (
                <aside className="w-72 flex-shrink-0">
                  <div className="sticky top-6 max-h-[calc(100vh-120px)] overflow-y-auto pr-1 space-y-1 scrollbar-thin">
                    {sidebarContent}
                  </div>
                </aside>
              )}

              <div className="flex-1 min-w-0">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeId}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    transition={{ duration: 0.25 }}
                  >
                    <LessonDetail
                      lesson={activeLesson}
                      isCompleted={isCompleted}
                      isWizardDone={isWizardDone}
                      onToggleComplete={handleToggleComplete}
                      isToggling={markMutation.isPending}
                      onPrev={() => prevLesson && handleSelect(prevLesson.id)}
                      onNext={() => nextLesson && handleSelect(nextLesson.id)}
                      hasPrev={!!prevLesson}
                      hasNext={!!nextLesson}
                    />
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
