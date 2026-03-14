import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Play, Pause, Clock, Image, ChevronDown, ChevronRight, List, Volume2, VolumeX, Maximize, AlertCircle } from "lucide-react";

interface GuideStep {
  id: string;
  step_number: number;
  timestamp: string | null;
  title: string;
  description: string;
  screenshot_url: string | null;
  sort_order: number;
}

interface LocalInteractivePlayerProps {
  steps: GuideStep[];
  videoUrl: string;
}

function parseTimestamp(ts: string | null): number {
  if (!ts) return 0;
  const parts = ts.split(':').map(Number);
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return 0;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function LocalInteractivePlayer({ steps, videoUrl }: LocalInteractivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const [videoError, setVideoError] = useState(false);

  const seekToStep = useCallback((idx: number) => {
    const video = videoRef.current;
    if (!video || !steps[idx]) return;
    const time = parseTimestamp(steps[idx].timestamp);
    video.currentTime = time;
    setActiveStep(idx);
    if (!isPlaying) {
      video.play().catch(() => {});
    }
    stepRefs.current[idx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [steps, isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const t = video.currentTime;
      setCurrentTime(t);
      let bestIdx = 0;
      for (let i = 0; i < steps.length; i++) {
        const stepTime = parseTimestamp(steps[i].timestamp);
        if (t >= stepTime) bestIdx = i;
        else break;
      }
      if (bestIdx !== activeStep) {
        setActiveStep(bestIdx);
        stepRefs.current[bestIdx]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    };

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onDuration = () => setDuration(video.duration);

    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('loadedmetadata', onDuration);

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('loadedmetadata', onDuration);
    };
  }, [steps, activeStep]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.requestFullscreen) video.requestFullscreen();
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const video = videoRef.current;
    if (!video || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const fraction = (e.clientX - rect.left) / rect.width;
    video.currentTime = fraction * duration;
  };

  if (videoError) {
    return (
      <div className="flex flex-col">
        <div
          className="relative w-full overflow-hidden rounded-t-xl"
          style={{
            paddingTop: "56.25%",
            background: "linear-gradient(135deg, #1a0000 0%, #4a1c1c 50%, #1a0000 100%)",
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-400" />
            <div>
              <p className="text-white font-semibold text-base mb-1">Errore video</p>
              <p className="text-red-200 text-sm">Il file video locale non e' riproducibile o e' danneggiato</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="relative bg-black rounded-t-xl overflow-hidden group">
        <video
          ref={videoRef}
          src={videoUrl}
          className="w-full aspect-video"
          playsInline
          preload="metadata"
          onClick={togglePlay}
          onError={() => setVideoError(true)}
        />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          {!isPlaying && (
            <div className="w-16 h-16 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center">
              <Play className="w-8 h-8 text-white ml-1" />
            </div>
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <div
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-2 group/progress"
            onClick={handleProgressClick}
          >
            <div
              className="h-full bg-indigo-500 rounded-full relative transition-all"
              style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white shadow-md opacity-0 group-hover/progress:opacity-100 transition-opacity" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button onClick={togglePlay} className="text-white hover:text-indigo-300 transition-colors">
                {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>
              <button onClick={toggleMute} className="text-white hover:text-indigo-300 transition-colors">
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <span className="text-xs text-white/80 font-mono">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            <button onClick={toggleFullscreen} className="text-white hover:text-indigo-300 transition-colors">
              <Maximize className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="border-x border-b border-border/60 rounded-b-xl overflow-hidden bg-card">
        <div className="lg:hidden border-b border-border/40">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/30 transition-colors"
          >
            <span className="flex items-center gap-2">
              <List className="w-4 h-4 text-indigo-500" />
              Passaggi ({steps.length})
            </span>
            {tocOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {tocOpen && (
            <div className="px-3 pb-3 space-y-0.5 max-h-48 overflow-y-auto">
              {steps.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => { seekToStep(idx); setTocOpen(false); }}
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
                  {step.timestamp && (
                    <span className="text-[10px] text-muted-foreground ml-auto flex-shrink-0">{step.timestamp}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row">
          <aside className="hidden lg:block w-56 xl:w-64 flex-shrink-0 border-r border-border/40 max-h-[500px] overflow-y-auto scrollbar-thin">
            <div className="px-3 py-3 border-b border-border/40 bg-muted/20">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Passaggi</p>
            </div>
            <div className="p-2 space-y-0.5">
              {steps.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => seekToStep(idx)}
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
                  <div className="flex-1 min-w-0">
                    <span className="text-xs leading-tight line-clamp-2 block">{step.title}</span>
                    {step.timestamp && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {step.timestamp}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </aside>

          <div ref={stepsContainerRef} className="flex-1 min-w-0 p-4 sm:p-5 space-y-4 max-h-[500px] overflow-y-auto scrollbar-thin">
            {steps.map((step, idx) => (
              <div
                key={step.id}
                ref={el => { stepRefs.current[idx] = el; }}
                onClick={() => seekToStep(idx)}
                className={cn(
                  "rounded-xl border transition-all cursor-pointer",
                  activeStep === idx
                    ? "border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50/50 to-blue-50/30 dark:from-indigo-950/20 dark:to-blue-950/10 shadow-md ring-1 ring-indigo-200/50 dark:ring-indigo-800/50"
                    : "border-border/40 hover:border-border/80 hover:shadow-sm"
                )}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3 mb-2">
                    <span className={cn(
                      "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm",
                      activeStep === idx
                        ? "bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-indigo-200 dark:shadow-indigo-900/50"
                        : "bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-600 text-slate-600 dark:text-slate-300"
                    )}>
                      {step.step_number}
                    </span>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground leading-tight">
                        {step.title}
                      </h4>
                      {step.timestamp && (
                        <button
                          onClick={(e) => { e.stopPropagation(); seekToStep(idx); }}
                          className="inline-flex items-center gap-1 mt-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                        >
                          <Clock className="w-3 h-3" />
                          {step.timestamp}
                        </button>
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
                      <div className="relative rounded-xl overflow-hidden border border-border/60 shadow-lg bg-muted/20">
                        <img
                          src={step.screenshot_url}
                          alt={`Step ${step.step_number}: ${step.title}`}
                          className="w-full h-auto"
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
      </div>
    </div>
  );
}
