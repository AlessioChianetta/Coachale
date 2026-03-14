import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface GenerationProgressModalProps {
  open: boolean;
  step: string;
  message: string;
  progress: number;
  status: "pending" | "running" | "done" | "error";
  onClose?: () => void;
}

const STEPS = [
  {
    key: "starting",
    label: "Avvio",
    description: "Avvio generazione",
    emoji: "🚀",
  },
  {
    key: "loading_context",
    label: "Contesto",
    description: "Knowledge Base e contesto",
    emoji: "📚",
  },
  {
    key: "building_prompt",
    label: "Prompt",
    description: "Costruzione del prompt",
    emoji: "✏️",
  },
  {
    key: "thinking",
    label: "Pensiero profondo",
    description: "AI in elaborazione (16k token di pensiero)",
    emoji: "🧠",
  },
  {
    key: "parsing",
    label: "Elaborazione",
    description: "Strutturazione delle idee",
    emoji: "⚡",
  },
  {
    key: "compressing",
    label: "Ottimizzazione",
    description: "Verifica limiti e copy",
    emoji: "✂️",
  },
  {
    key: "done",
    label: "Completato",
    description: "Idee pronte!",
    emoji: "✅",
  },
];

function getStepState(
  stepKey: string,
  currentStep: string,
  status: string
): "done" | "active" | "upcoming" {
  if (status === "done") return "done";
  if (status === "error") return "upcoming";

  const stepIndex = STEPS.findIndex((s) => s.key === stepKey);
  const currentIndex = STEPS.findIndex((s) => s.key === currentStep);

  if (currentIndex === -1) return stepIndex === 0 ? "active" : "upcoming";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "upcoming";
}

export function GenerationProgressModal({
  open,
  step,
  message,
  progress,
  status,
  onClose,
}: GenerationProgressModalProps) {
  const isError = status === "error";
  const isDone = status === "done";
  const canClose = isError || isDone;

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && canClose && onClose) onClose();
      }}
    >
      <DialogContent
        className="sm:max-w-md p-0 overflow-hidden gap-0 [&>button]:hidden"
        onPointerDownOutside={(e) => { if (!canClose) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (!canClose) e.preventDefault(); }}
      >
        <div className="px-6 pt-6 pb-2">
          <div className="flex items-center gap-3 mb-1">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-xl flex-shrink-0",
                isError
                  ? "bg-red-100 dark:bg-red-900/30"
                  : isDone
                  ? "bg-green-100 dark:bg-green-900/30"
                  : "bg-violet-100 dark:bg-violet-900/30"
              )}
            >
              {isError ? "❌" : isDone ? "✅" : "🧠"}
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">
                {isError
                  ? "Generazione fallita"
                  : isDone
                  ? "Generazione completata!"
                  : "Generazione in corso..."}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5 leading-tight">
                {message}
              </p>
            </div>
          </div>

          <div className="mt-4 mb-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>
                {isError ? "Errore" : `${Math.round(progress)}%`}
              </span>
              <span className="text-violet-600 dark:text-violet-400 font-medium">
                Pensiero AI: alto (16k token)
              </span>
            </div>
            <Progress
              value={isError ? 100 : progress}
              className={cn(
                "h-2 transition-all duration-700",
                isError && "[&>div]:bg-red-500",
                isDone && "[&>div]:bg-green-500"
              )}
            />
          </div>
        </div>

        <div className="px-6 pb-5 pt-3">
          <div className="space-y-0.5">
            {STEPS.map((s) => {
              const state = getStepState(s.key, step, status);
              return (
                <div
                  key={s.key}
                  className={cn(
                    "flex items-center gap-3 py-2 px-2.5 rounded-lg transition-all duration-300",
                    state === "active" && "bg-violet-50 dark:bg-violet-950/30",
                    state === "done" && "opacity-55",
                    state === "upcoming" && "opacity-25"
                  )}
                >
                  <div
                    className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0 transition-all duration-300",
                      state === "done" &&
                        "bg-green-100 dark:bg-green-900/40 text-green-600",
                      state === "active" &&
                        "bg-violet-100 dark:bg-violet-900/40 ring-2 ring-violet-400/50",
                      state === "upcoming" && "bg-muted text-muted-foreground"
                    )}
                  >
                    {state === "done" ? (
                      "✓"
                    ) : (
                      <span className={state === "active" ? "animate-pulse" : ""}>
                        {s.emoji}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        state === "active" &&
                          "text-violet-700 dark:text-violet-300"
                      )}
                    >
                      {s.label}
                    </span>
                    {state === "active" && !isDone && (
                      <p className="text-xs text-muted-foreground leading-tight">
                        {s.description}
                      </p>
                    )}
                  </div>
                  {state === "active" && !isDone && !isError && (
                    <div className="flex gap-0.5 flex-shrink-0">
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-bounce"
                          style={{ animationDelay: `${i * 0.18}s` }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {isError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-200 dark:border-red-800">
              <p className="text-sm text-red-600 dark:text-red-400">{message}</p>
            </div>
          )}

          <p className="text-center text-xs text-muted-foreground mt-4">
            {isError
              ? "Chiudi questa finestra e riprova"
              : isDone
              ? "Stai per vedere le tue idee..."
              : "Il pensiero profondo richiede qualche momento in più — circa 30-60 secondi"}
          </p>

          {canClose && onClose && (
            <div className="mt-3 flex justify-center">
              <Button
                variant={isError ? "destructive" : "outline"}
                size="sm"
                onClick={onClose}
              >
                {isError ? "Chiudi" : "Vedi le idee"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
