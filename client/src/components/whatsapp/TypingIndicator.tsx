import { cn } from "@/lib/utils";

export function TypingIndicator() {
  return (
    <div className="flex w-full justify-start animate-fade-in">
      <div className="flex flex-col max-w-[80%] gap-1.5 items-start">
        <div
          className={cn(
            "rounded-lg rounded-tl-sm px-4 py-3 shadow-md",
            "bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
          )}
        >
          <div className="flex items-center gap-1">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] px-1 mt-0.5 text-gray-400">
          <span className="font-normal">sta scrivendo...</span>
        </div>
      </div>
    </div>
  );
}
