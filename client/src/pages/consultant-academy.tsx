import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { GuiddePlayer } from "@/components/academy/GuiddePlayer";
import { StepByStepGuide } from "@/components/academy/StepByStepGuide";
import { getAuthHeaders } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, ChevronDown, ChevronRight, ExternalLink,
  ArrowLeft, ArrowRight, GraduationCap, Settings, Clock,
  ChevronUp, FileText, Loader2, Rocket, BookOpen, Sparkles, Wrench,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { DeliveryAgentPanel } from "@/components/delivery-agent/DeliveryAgentPanel";
import { ChatPanel } from "@/components/ai-assistant/ChatPanel";
import ConsultantSetupWizard from "@/pages/consultant-setup-wizard";

interface AcademyDocument {
  id: string;
  title: string;
  file_url: string;
  file_type: string;
}

interface AcademyVideo {
  id: string;
  title: string;
  video_url: string;
  video_type: string;
}

interface AcademyStep {
  id: string;
  step_number: number;
  timestamp: string | null;
  title: string;
  description: string;
  screenshot_url: string | null;
  sort_order: number;
}

interface AcademyLesson {
  id: string;
  lesson_id: string;
  module_id: string;
  title: string;
  description: string;
  content?: string | null;
  duration: string;
  video_url: string | null;
  video_type: string;
  config_link: string;
  sort_order: number;
  documents: AcademyDocument[];
  videos?: AcademyVideo[];
  steps?: AcademyStep[];
  guide_embed_url?: string | null;
  guide_local_video_url?: string | null;
  guide_display_mode?: string;
}

interface AcademyModule {
  id: string;
  slug: string;
  title: string;
  emoji: string;
  tagline: string;
  color: string;
  sort_order: number;
  lessons: AcademyLesson[];
}

const COLOR_GRADIENTS: Record<string, string> = {
  slate: "from-slate-500 to-slate-700",
  blue: "from-blue-500 to-blue-700",
  violet: "from-violet-500 to-purple-700",
  indigo: "from-indigo-500 to-blue-700",
  amber: "from-amber-500 to-orange-600",
  rose: "from-rose-500 to-red-700",
  green: "from-green-500 to-green-700",
  red: "from-red-500 to-red-700",
  orange: "from-orange-500 to-orange-700",
  teal: "from-teal-500 to-teal-700",
};

const COLOR_BADGES: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  violet: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  indigo: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  amber: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  rose: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
  green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  orange: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  teal: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300",
};

interface StepStatusEntry {
  stepId: string;
  status: "pending" | "configured" | "verified" | "error" | "skipped";
}

function useAcademyData() {
  const queryClient = useQueryClient();

  const { data: modulesData, isLoading: modulesLoading } = useQuery<AcademyModule[]>({
    queryKey: ["/api/consultant/academy/modules"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/academy/modules", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch academy modules");
      const json = await res.json();
      return json.data || [];
    },
    staleTime: 60_000,
  });

  const { data: wizardData } = useQuery<{ success: boolean; data: StepStatusEntry[] }>({
    queryKey: ["/api/consultant/onboarding/status/for-ai"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/status/for-ai", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch wizard status");
      return res.json();
    },
    staleTime: 60_000,
  });

  const { data: manualData } = useQuery<{ success: boolean; data: string[] }>({
    queryKey: ["/api/consultant/academy/completions"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/academy/completions", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch academy completions");
      return res.json();
    },
    staleTime: 30_000,
  });

  const modules = modulesData || [];
  const lessonsFlat = useMemo(() => modules.flatMap(m => m.lessons), [modules]);
  const lessonById = useMemo(() => {
    const map: Record<string, AcademyLesson> = {};
    for (const l of lessonsFlat) { map[l.lesson_id] = l; }
    return map;
  }, [lessonsFlat]);

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

  return { modules, lessonsFlat, lessonById, wizardCompleted, manualCompleted, allCompleted, markMutation, modulesLoading, onboardingStatuses: wizardData?.data };
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
  module: AcademyModule;
  completedIds: Set<string>;
  wizardCompleted: Set<string>;
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const completedInModule = module.lessons.filter(l => completedIds.has(l.lesson_id)).length;
  const isAnyActive = module.lessons.some(l => l.lesson_id === activeId);
  const [open, setOpen] = useState(isAnyActive);

  useEffect(() => {
    if (isAnyActive) setOpen(true);
  }, [isAnyActive]);

  const gradientClass = COLOR_GRADIENTS[module.color] ?? "from-slate-500 to-slate-700";

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
                  isActive={lesson.lesson_id === activeId}
                  isCompleted={completedIds.has(lesson.lesson_id)}
                  isWizardDone={wizardCompleted.has(lesson.lesson_id)}
                  onClick={() => onSelect(lesson.lesson_id)}
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
  module,
  isCompleted,
  isWizardDone,
  onToggleComplete,
  isToggling,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
  lessonIndex,
  totalLessons,
}: {
  lesson: AcademyLesson;
  module: AcademyModule | undefined;
  isCompleted: boolean;
  isWizardDone: boolean;
  onToggleComplete: () => void;
  isToggling: boolean;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
  lessonIndex: number;
  totalLessons: number;
}) {
  const badgeClass = module ? (COLOR_BADGES[module.color] ?? "") : "";
  const gradientClass = module ? (COLOR_GRADIENTS[module.color] ?? "from-slate-500 to-slate-700") : "from-slate-500 to-slate-700";

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {(() => {
        const hasInteractiveGuide = !!lesson.guide_local_video_url && lesson.steps && lesson.steps.length > 0;
        if (hasInteractiveGuide) return null;

        const allVids: Array<{ url: string; type: string; title: string }> = [];
        if (lesson.video_url) {
          allVids.push({ url: lesson.video_url, type: lesson.video_type, title: lesson.title });
        }
        if (lesson.videos) {
          lesson.videos.forEach(v => allVids.push({ url: v.video_url, type: v.video_type, title: v.title || lesson.title }));
        }
        if (allVids.length === 0) {
          return <GuiddePlayer embedUrl={null} localVideoUrl={lesson.guide_local_video_url} videoType="iframe" title={lesson.title} />;
        }
        if (allVids.length === 1) {
          return <GuiddePlayer embedUrl={allVids[0].url} localVideoUrl={lesson.guide_local_video_url} videoType={allVids[0].type} title={allVids[0].title} />;
        }
        return (
          <div className="space-y-4">
            {allVids.map((vid, idx) => (
              <div key={idx}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white text-xs font-bold">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-foreground">{vid.title}</p>
                  <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                    Video {idx + 1} di {allVids.length}
                  </span>
                </div>
                <GuiddePlayer embedUrl={vid.url} videoType={vid.type} title={vid.title} />
              </div>
            ))}
          </div>
        );
      })()}

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className={cn("h-1 bg-gradient-to-r", gradientClass)} />
        <div className="px-3 py-2.5 sm:px-4 sm:py-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              {module && (
                <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0", badgeClass)}>
                  {module.emoji} {module.title}
                </span>
              )}
              <span className="text-[11px] text-muted-foreground flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" /> {lesson.duration}
              </span>
              <span className="text-[11px] text-muted-foreground shrink-0">
                Lezione {lessonIndex + 1}/{totalLessons}
              </span>
              <h1 className="text-sm sm:text-base font-bold text-foreground leading-tight truncate">
                {lesson.title}
              </h1>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isWizardDone && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Configurato</span>
                </div>
              )}

              {lesson.config_link && (
                <Link href={lesson.config_link}>
                  <Button variant="outline" size="sm" className="gap-1.5 h-7 text-xs">
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Configurazione</span>
                    <ExternalLink className="w-3 h-3 opacity-60" />
                  </Button>
                </Link>
              )}

              {!isWizardDone && (
                <Button
                  size="sm"
                  onClick={onToggleComplete}
                  disabled={isToggling}
                  className={cn(
                    "gap-1.5 h-7 text-xs transition-colors",
                    isCompleted
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-indigo-600 hover:bg-indigo-700 text-white"
                  )}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isCompleted ? "Completata ✓" : "Completa"}
                </Button>
              )}
            </div>
          </div>

          {lesson.description && (
            <p className="text-muted-foreground text-xs leading-relaxed mt-1.5 line-clamp-2">
              {lesson.description}
            </p>
          )}
        </div>
      </div>

      {lesson.content && (() => {
        const sections: Array<{ heading: string | null; items: Array<{ type: 'p' | 'ol' | 'ul'; lines: string[] }> }> = [];
        let currentSection: (typeof sections)[0] = { heading: null, items: [] };
        let currentList: { type: 'ol' | 'ul'; lines: string[] } | null = null;

        const flushList = () => {
          if (currentList) { currentSection.items.push(currentList); currentList = null; }
        };

        lesson.content!.split('\n').forEach(rawLine => {
          const line = rawLine.trim();
          if (!line) { flushList(); return; }

          if ((line.startsWith('**') && line.endsWith('**')) ||
              (line.startsWith('**') && line.includes(':**'))) {
            flushList();
            if (currentSection.heading !== null || currentSection.items.length > 0) {
              sections.push(currentSection);
            }
            currentSection = { heading: line.replace(/\*\*/g, ''), items: [] };
            return;
          }

          if (/^\d+\.\s/.test(line)) {
            if (currentList?.type !== 'ol') { flushList(); currentList = { type: 'ol', lines: [] }; }
            currentList!.lines.push(line.replace(/^\d+\.\s*/, ''));
            return;
          }
          if (line.startsWith('- ')) {
            if (currentList?.type !== 'ul') { flushList(); currentList = { type: 'ul', lines: [] }; }
            currentList!.lines.push(line.slice(2));
            return;
          }

          flushList();
          currentSection.items.push({ type: 'p', lines: [line] });
        });
        flushList();
        if (currentSection.heading !== null || currentSection.items.length > 0) {
          sections.push(currentSection);
        }

        const renderInline = (text: string) => text.replace(/\*\*(.*?)\*\*/g, '<strong class="text-foreground font-semibold">$1</strong>');

        return (
          <div className="space-y-4">
            {sections.map((section, si) => (
              <div key={si} className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
                {section.heading && (
                  <div className="px-4 py-3 border-b border-border/40 bg-muted/40">
                    <h3 className="text-sm md:text-base font-bold text-foreground flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 bg-indigo-500" />
                      {section.heading}
                    </h3>
                  </div>
                )}
                <div className="p-4 space-y-3">
                  {section.items.map((item, ii) => {
                    if (item.type === 'p') {
                      return (
                        <p key={ii} className="text-sm md:text-[15px] text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: renderInline(item.lines[0]) }} />
                      );
                    }
                    if (item.type === 'ol') {
                      return (
                        <div key={ii} className="space-y-2">
                          {item.lines.map((ol, oi) => (
                            <div key={oi} className="flex gap-3 items-start">
                              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-blue-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                {oi + 1}
                              </span>
                              <span className="text-sm md:text-[15px] text-muted-foreground leading-relaxed flex-1 min-w-0" dangerouslySetInnerHTML={{ __html: renderInline(ol) }} />
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return (
                      <div key={ii} className="space-y-1.5 pl-1">
                        {item.lines.map((ul, ui) => (
                          <div key={ui} className="flex gap-2.5 items-start">
                            <ChevronRight className="w-3.5 h-3.5 text-indigo-500 mt-1 flex-shrink-0" />
                            <span className="text-sm md:text-[15px] text-muted-foreground leading-relaxed flex-1 min-w-0" dangerouslySetInnerHTML={{ __html: renderInline(ul) }} />
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        );
      })()}

      {lesson.documents && lesson.documents.length > 0 && (
        <div className="bg-card rounded-xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-muted/30">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Documenti allegati</p>
          </div>
          <div className="p-3 space-y-1.5">
            {lesson.documents.map(doc => (
              <a
                key={doc.id}
                href={doc.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 hover:underline p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
              >
                <FileText className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 truncate">{doc.title}</span>
                <Badge variant="outline" className="text-[10px]">{doc.file_type}</Badge>
                <ExternalLink className="w-3 h-3 opacity-50" />
              </a>
            ))}
          </div>
        </div>
      )}

      {((lesson.steps && lesson.steps.length > 0) || lesson.guide_embed_url || lesson.guide_local_video_url) && (
        <StepByStepGuide
          steps={lesson.steps || []}
          guideEmbedUrl={lesson.guide_embed_url}
          guideLocalVideoUrl={lesson.guide_local_video_url}
          displayMode={lesson.guide_display_mode || "native"}
        />
      )}

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
          Lezione {lessonIndex + 1} di {totalLessons}
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
  const urlSessionId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("sessionId") || null;
  }, []);

  const urlTab = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("tab") || null;
  }, []);

  const [activeTab, setActiveTab] = useState<"academy" | "delivery" | "setup-assistant" | "setup-wizard">(
    urlTab === "delivery" ? "delivery" : urlSessionId ? "delivery" : "academy"
  );
  const [setupChatStarted, setSetupChatStarted] = useState(false);
  const [setupAutoMessage, setSetupAutoMessage] = useState<string | null>(null);
  const [setupChatKey, setSetupChatKey] = useState(0);
  const [sidebarTab, setSidebarTab] = useState<"setup" | "corsi">("setup");
  const { modules, lessonsFlat, lessonById, wizardCompleted, manualCompleted, allCompleted, markMutation, modulesLoading, onboardingStatuses } = useAcademyData();

  const setupModules = useMemo(() => modules.filter(m => !m.slug.startsWith('pkg_')), [modules]);
  const corsiModules = useMemo(() => modules.filter(m => m.slug.startsWith('pkg_')), [modules]);
  const setupLessons = useMemo(() => lessonsFlat.filter(l => setupModules.some(m => m.id === l.module_id)), [lessonsFlat, setupModules]);
  const corsiLessons = useMemo(() => lessonsFlat.filter(l => corsiModules.some(m => m.id === l.module_id)), [lessonsFlat, corsiModules]);
  const filteredModules = sidebarTab === "setup" ? setupModules : corsiModules;
  const filteredLessons = sidebarTab === "setup" ? setupLessons : corsiLessons;

  const totalLessons = lessonsFlat.length;

  const initialStepId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const step = params.get("step");
    if (step && lessonById[step]) return step;
    return lessonsFlat[0]?.lesson_id || "";
  }, [lessonsFlat.length > 0]);

  const [activeId, setActiveId] = useState<string>(initialStepId);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  useEffect(() => {
    if (lessonsFlat.length > 0) {
      const params = new URLSearchParams(window.location.search);
      const stepParam = params.get("step");
      if (stepParam && lessonById[stepParam] && activeId !== stepParam) {
        setActiveId(stepParam);
        const lesson = lessonById[stepParam];
        if (lesson) {
          const belongsToCorsi = corsiModules.some(m => m.id === lesson.module_id);
          setSidebarTab(belongsToCorsi ? "corsi" : "setup");
        }
        return;
      }
      if (!activeId) {
        setActiveId(lessonsFlat[0].lesson_id);
      }
    }
  }, [lessonsFlat.length, Object.keys(lessonById).length, location]);

  const activeLesson = lessonById[activeId] ?? lessonsFlat[0];
  const activeModule = activeLesson ? modules.find(m => m.id === activeLesson.module_id) : undefined;
  const activeIndex = lessonsFlat.findIndex(l => l.lesson_id === activeId);
  const prevLesson = activeIndex > 0 ? lessonsFlat[activeIndex - 1] : null;
  const nextLesson = activeIndex < lessonsFlat.length - 1 ? lessonsFlat[activeIndex + 1] : null;

  const totalCompleted = allCompleted.size;
  const progressPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;

  const handleSelect = useCallback((id: string) => {
    setActiveId(id);
    setMobileSidebarOpen(false);
    const lesson = lessonById[id];
    if (lesson) {
      const isSetupLesson = setupModules.some(m => m.id === lesson.module_id);
      setSidebarTab(isSetupLesson ? "setup" : "corsi");
    }
    setTimeout(() => {
      const panel = document.getElementById('academy-content-panel');
      if (panel) panel.scrollTop = 0;
    }, 50);
  }, [lessonById, setupModules]);

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

  if (modulesLoading) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <main className="flex-1 flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
          </main>
        </div>
      </div>
    );
  }

  const filteredCompleted = filteredLessons.filter(l => allCompleted.has(l.lesson_id)).length;
  const filteredTotal = filteredLessons.length;
  const filteredPct = filteredTotal > 0 ? Math.round((filteredCompleted / filteredTotal) * 100) : 0;

  const sidebarContent = (
    <div className="flex flex-col gap-3">
      <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
        <button
          onClick={() => setSidebarTab("setup")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            sidebarTab === "setup"
              ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Settings className="w-3.5 h-3.5" />
          Setup
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
            {setupLessons.filter(l => allCompleted.has(l.lesson_id)).length}/{setupLessons.length}
          </Badge>
        </button>
        <button
          onClick={() => setSidebarTab("corsi")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
            sidebarTab === "corsi"
              ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="w-3.5 h-3.5" />
          Accademia
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">
            {corsiLessons.filter(l => allCompleted.has(l.lesson_id)).length}/{corsiLessons.length}
          </Badge>
        </button>
      </div>

      <div className="space-y-1 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">{filteredCompleted}/{filteredTotal} lezioni</span>
          <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{filteredPct}%</span>
        </div>
        <div className="h-2.5 rounded-full bg-muted overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500"
            initial={{ width: 0 }}
            animate={{ width: `${filteredPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {filteredCompleted === filteredTotal ? "🎉 Sezione completata!" : `Ancora ${filteredTotal - filteredCompleted} da completare`}
        </p>
      </div>

      <div className="space-y-2">
        {filteredModules.map(mod => (
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
    <div className="flex flex-col bg-background h-[100dvh] max-h-[100dvh]">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
          <div className="border-b border-border/60 bg-card/50 flex-shrink-0">
            <div className="flex items-center gap-1.5 sm:gap-3 px-2 sm:px-4 py-1.5 sm:py-2">
              <Link href="/consultant">
                <Button variant="ghost" size="sm" className="h-7 sm:h-8 w-7 sm:w-auto p-0 sm:px-3 sm:gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
              <div className="flex items-center bg-muted/50 rounded-xl p-0.5 sm:p-1 gap-0.5 sm:gap-1 flex-1 min-w-0">
                {([
                  { key: "academy" as const, label: "Accademia", shortLabel: "Academy", icon: <GraduationCap className="w-4 h-4" />, gradient: "from-indigo-500 to-blue-600" },
                  { key: "delivery" as const, label: "Delivery AI", shortLabel: "Delivery", icon: <Rocket className="w-4 h-4" />, gradient: "from-violet-500 to-purple-600" },
                  { key: "setup-assistant" as const, label: "Assistente Setup", shortLabel: "Setup", icon: <Sparkles className="w-4 h-4" />, gradient: "from-emerald-500 to-teal-600" },
                  { key: "setup-wizard" as const, label: "Setup Wizard", shortLabel: "Wizard", icon: <Wrench className="w-4 h-4" />, gradient: "from-amber-500 to-orange-600" },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={cn(
                      "flex items-center justify-center sm:gap-1.5 md:gap-2 px-2.5 py-2 sm:px-3 sm:py-2 md:px-4 rounded-lg text-[11px] sm:text-xs md:text-sm font-medium transition-all flex-1 min-w-0",
                      activeTab === tab.key
                        ? `bg-gradient-to-r ${tab.gradient} text-white shadow-md`
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                    title={tab.label}
                  >
                    {tab.icon}
                    <span className="hidden sm:inline md:hidden">{tab.shortLabel}</span>
                    <span className="hidden md:inline">{tab.label}</span>
                  </button>
                ))}
              </div>

              {activeTab === "academy" && (
                <div className="hidden sm:flex items-center gap-2 shrink-0">
                  <div className="w-24 lg:w-32 h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-indigo-600 dark:text-indigo-400">{progressPct}%</span>
                </div>
              )}
            </div>
          </div>

          {activeTab === "delivery" ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <DeliveryAgentPanel initialSessionId={urlSessionId} onBack={() => setActiveTab("academy")} />
            </div>
          ) : activeTab === "setup-wizard" ? (
            <div className="flex-1 min-h-0 overflow-hidden">
              <ConsultantSetupWizard embedded />
            </div>
          ) : activeTab === "setup-assistant" ? (
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {!setupChatStarted && (
                <div className="shrink-0 border-b border-emerald-100 dark:border-emerald-900/40 bg-gradient-to-b from-emerald-50/80 to-white dark:from-emerald-950/30 dark:to-background overflow-y-auto" style={{ maxHeight: "20rem" }}>
                  <div className="flex items-center justify-between px-4 pt-3 pb-2">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Inizia da qui</p>
                    <button
                      onClick={() => setSetupChatStarted(true)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Nascondi
                    </button>
                  </div>
                  <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-w-3xl mx-auto">
                    {[
                      "Da dove inizio? Quali sono i primi step critici?",
                      "Cosa fa esattamente l'agente inbound e quando conviene usarlo?",
                      "Qual è la differenza tra agente outbound e campagna WhatsApp?",
                      "Come funziona l'AI Autonomo e cosa può fare per me ogni giorno?",
                      "Come configuro Twilio per WhatsApp Business?",
                      "Cosa devo caricare nella Knowledge Base per far funzionare bene gli agenti?",
                      "Come funziona l'Email Journey dopo una consulenza?",
                      "Quando ha senso usare le chiamate vocali AI?",
                      "Come collego Stripe per incassare automaticamente?",
                      "Ho un problema con uno step, mi aiuti a risolverlo?",
                    ].map((q, i) => (
                      <button
                        key={i}
                        onClick={() => { setSetupAutoMessage(q); setSetupChatStarted(true); setSetupChatKey(k => k + 1); }}
                        className="w-full text-left text-xs p-2.5 rounded-xl bg-card/80 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 text-foreground border border-border hover:border-emerald-300 dark:hover:border-emerald-700 transition-all duration-150 leading-relaxed flex items-start gap-2.5 group shadow-sm"
                      >
                        <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold flex items-center justify-center group-hover:bg-emerald-200 dark:group-hover:bg-emerald-800 transition-colors">
                          {i + 1}
                        </span>
                        <span>{q}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                <ChatPanel
                  key={setupChatKey}
                  isOpen={true}
                  onClose={() => setActiveTab("academy")}
                  mode="assistenza"
                  setMode={() => {}}
                  consultantType="finanziario"
                  setConsultantType={() => {}}
                  isConsultantMode={true}
                  isOnboardingMode={true}
                  embedded={true}
                  onboardingStatuses={onboardingStatuses}
                  autoMessage={setupAutoMessage}
                  onAutoMessageSent={() => setSetupAutoMessage(null)}
                />
              </div>
            </div>
          ) : (
          <div className="flex flex-col h-full">
            {isMobile && (
              <div className="flex-shrink-0 px-2.5 sm:px-4 pt-2 sm:pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-1.5 sm:gap-2 justify-between h-9 sm:h-10"
                  onClick={() => setMobileSidebarOpen(p => !p)}
                >
                  <span className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="shrink-0">{activeModule?.emoji}</span>
                    <span className="text-[11px] sm:text-sm font-medium truncate">{activeLesson?.title}</span>
                  </span>
                  <span className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    <Badge variant="secondary" className="text-[10px] sm:text-xs">{totalCompleted}/{totalLessons}</Badge>
                    {mobileSidebarOpen ? <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
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

            <div className="flex-1 min-h-0 flex">
              {!isMobile && (
                <aside className="w-72 flex-shrink-0 border-r border-border/40 overflow-y-auto p-4 scrollbar-thin">
                  {sidebarContent}
                </aside>
              )}

              <div id="academy-content-panel" className="flex-1 min-w-0 overflow-y-auto">
                <div className="max-w-4xl mx-auto px-3 sm:px-6 py-3 sm:py-6">
                  {activeLesson ? (
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
                          module={activeModule}
                          isCompleted={isCompleted}
                          isWizardDone={isWizardDone}
                          onToggleComplete={handleToggleComplete}
                          isToggling={markMutation.isPending}
                          onPrev={() => prevLesson && handleSelect(prevLesson.lesson_id)}
                          onNext={() => nextLesson && handleSelect(nextLesson.lesson_id)}
                          hasPrev={!!prevLesson}
                          hasNext={!!nextLesson}
                          lessonIndex={activeIndex}
                          totalLessons={totalLessons}
                        />
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <div className="text-center text-muted-foreground py-20">Nessuna lezione disponibile</div>
                  )}
                </div>
              </div>
            </div>
          </div>
          )}
        </main>
      </div>
    </div>
  );
}
