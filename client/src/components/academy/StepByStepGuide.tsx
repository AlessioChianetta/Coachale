import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, List, Image, Clock } from "lucide-react";
import { LocalInteractivePlayer } from "./LocalInteractivePlayer";

interface GuideStep {
  id: string;
  step_number: number;
  timestamp: string | null;
  title: string;
  description: string;
  screenshot_url: string | null;
  sort_order: number;
}

interface StepByStepGuideProps {
  steps: GuideStep[];
  guideEmbedUrl?: string | null;
  guideLocalVideoUrl?: string | null;
  displayMode?: string;
}

export function StepByStepGuide({ steps, guideEmbedUrl, guideLocalVideoUrl, displayMode = "native" }: StepByStepGuideProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [tocOpen, setTocOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"native" | "embed">(
    displayMode === "embed" ? "embed" : "native"
  );

  useEffect(() => {
    setActiveTab(displayMode === "embed" ? "embed" : "native");
    setActiveStep(0);
    setTocOpen(false);
  }, [displayMode, steps]);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  const scrollToStep = useCallback((index: number) => {
    setActiveStep(index);
    setTocOpen(false);
    stepRefs.current[index]?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, []);

  if (!steps || steps.length === 0) {
    if (guideEmbedUrl && (displayMode === "embed" || displayMode === "both")) {
      return (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-indigo-500/10 to-blue-500/10">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-500" />
              Guida Interattiva
            </h3>
          </div>
          <div className="aspect-[7/8] w-full">
            <iframe
              src={guideEmbedUrl}
              className="w-full h-full border-0"
              allow="clipboard-write"
              allowFullScreen
              style={{ borderRadius: "0 0 1rem 1rem" }}
            />
          </div>
        </div>
      );
    }
    if (guideLocalVideoUrl && (displayMode === "embed" || displayMode === "both")) {
      return (
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-indigo-500/10 to-blue-500/10">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-500" />
              Guida Interattiva
            </h3>
          </div>
          <div className="p-4">
            <video src={guideLocalVideoUrl} controls className="w-full rounded-xl" />
          </div>
        </div>
      );
    }
    return null;
  }

  const hasLocalInteractive = !!guideLocalVideoUrl && steps.length > 0;
  const showTabs = displayMode === "both" && (guideEmbedUrl || hasLocalInteractive);

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border/40 bg-gradient-to-r from-indigo-500/10 to-blue-500/10">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <List className="w-4 h-4 text-indigo-500" />
            Guida Passo-Passo
            <span className="text-xs font-normal text-muted-foreground">
              {steps.length} {steps.length === 1 ? "passaggio" : "passaggi"}
            </span>
          </h3>

          {showTabs && (
            <div className="flex items-center bg-muted/60 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setActiveTab("native")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  activeTab === "native"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Guida
              </button>
              <button
                onClick={() => setActiveTab("embed")}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-medium transition-all",
                  activeTab === "embed"
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Interattiva
              </button>
            </div>
          )}
        </div>
      </div>

      {activeTab === "embed" && (hasLocalInteractive || guideEmbedUrl) ? (
        hasLocalInteractive ? (
          <LocalInteractivePlayer steps={steps} videoUrl={guideLocalVideoUrl!} />
        ) : (
          <div className="aspect-[7/8] w-full">
            <iframe
              src={guideEmbedUrl!}
              className="w-full h-full border-0"
              allow="clipboard-write"
              allowFullScreen
            />
          </div>
        )
      ) : (
        <div className="flex flex-col lg:flex-row">
          <div className="lg:hidden border-b border-border/40">
            <button
              onClick={() => setTocOpen(!tocOpen)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
            >
              <span className="flex items-center gap-2">
                <List className="w-4 h-4 text-indigo-500" />
                Indice ({steps.length} passaggi)
              </span>
              {tocOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            {tocOpen && (
              <div className="px-3 pb-3 space-y-0.5 max-h-60 overflow-y-auto">
                {steps.map((step, idx) => (
                  <button
                    key={step.id}
                    onClick={() => scrollToStep(idx)}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all text-sm",
                      activeStep === idx
                        ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                        : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    <span className={cn(
                      "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      activeStep === idx
                        ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {step.step_number}
                    </span>
                    <span className="truncate text-xs">{step.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <aside className="hidden lg:block w-56 xl:w-64 flex-shrink-0 border-r border-border/40 max-h-[600px] overflow-y-auto scrollbar-thin">
            <div className="px-3 py-3 border-b border-border/40 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Indice</p>
            </div>
            <div className="p-2 space-y-0.5">
              {steps.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => scrollToStep(idx)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-all",
                    activeStep === idx
                      ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 shadow-sm"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <span className={cn(
                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                    activeStep === idx
                      ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {step.step_number}
                  </span>
                  <span className="text-xs leading-tight line-clamp-2">{step.title}</span>
                </button>
              ))}
            </div>
          </aside>

          <div className="flex-1 min-w-0 p-4 sm:p-5 space-y-6 max-h-[600px] overflow-y-auto scrollbar-thin">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                ref={el => { stepRefs.current[idx] = el; }}
                onClick={() => setActiveStep(idx)}
                className={cn(
                  "rounded-xl border transition-all cursor-pointer",
                  activeStep === idx
                    ? "border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 dark:from-indigo-950/20 dark:to-blue-950/10 shadow-md"
                    : "border-border/40 hover:border-border/80 hover:shadow-sm"
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <span className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm",
                      activeStep === idx
                        ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-indigo-200 dark:shadow-indigo-900/50"
                        : "bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-slate-600 dark:text-slate-300"
                    )}>
                      {step.step_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm sm:text-base text-foreground leading-tight">
                        {step.title}
                      </h4>
                      {step.timestamp && (
                        <span className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium">
                          <Clock className="w-3 h-3" />
                          {step.timestamp}
                        </span>
                      )}
                    </div>
                  </div>

                  {step.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed pl-11">
                      {step.description}
                    </p>
                  )}

                  {step.screenshot_url && (
                    <div className="mt-3 pl-11">
                      <div className="relative rounded-xl overflow-hidden border border-border/60 shadow-lg bg-muted/20 max-w-2xl">
                        <img
                          src={step.screenshot_url}
                          alt={`Step ${step.step_number}: ${step.title}`}
                          className="w-full h-auto max-h-[420px] object-contain object-top"
                          loading="lazy"
                        />
                        <div className="absolute top-2 right-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/50 text-white text-[10px] font-medium backdrop-blur-sm">
                            <Image className="w-3 h-3" />
                            Step {step.step_number}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
