import { BookOpen } from "lucide-react";

export function PageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 dark:bg-[hsl(222,18%,6%)]">
      <div className="relative flex items-center justify-center">
        <div className="absolute w-16 h-16 rounded-full border-2 border-cyan-500/20 dark:border-cyan-400/10 animate-ping" />
        <div className="absolute w-20 h-20 rounded-full border border-teal-500/10 dark:border-teal-400/5 animate-[pulse_2s_ease-in-out_infinite]" />
        <div className="relative p-3 bg-gradient-to-br from-cyan-500 to-teal-500 rounded-xl shadow-lg shadow-cyan-500/20 animate-[pulse_1.5s_ease-in-out_infinite]">
          <BookOpen className="h-6 w-6 text-white" />
        </div>
      </div>
      <div className="mt-6 flex items-center gap-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-[bounce_1s_ease-in-out_infinite]" />
        <div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-[bounce_1s_ease-in-out_0.15s_infinite]" />
        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-[bounce_1s_ease-in-out_0.3s_infinite]" />
      </div>
      <p className="mt-3 text-sm font-medium text-slate-400 dark:text-slate-500">
        Caricamento...
      </p>
    </div>
  );
}
