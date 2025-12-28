import { useState, KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Mic } from "lucide-react";

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  onLiveModeClick?: () => void;
  rateLimitInfo?: {
    tokensUsed: number;
    resetAt: number;
    isWaiting: boolean;
  };
}

export function InputArea({ onSend, disabled = false, isProcessing = false, onLiveModeClick, rateLimitInfo }: InputAreaProps) {
  const cannotSend = disabled || isProcessing;
  const [message, setMessage] = useState("");
  const [, setLocation] = useLocation();

  const handleSend = () => {
    if (message.trim() && !cannotSend) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleLiveModeClick = () => {
    if (!cannotSend) {
      setLocation('/live-consultation');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const tokenPercentage = rateLimitInfo ? (rateLimitInfo.tokensUsed / 245000) * 100 : 0;
  const timeUntilReset = rateLimitInfo ? Math.max(0, Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000)) : 0;

  return (
    <div className="space-y-3">
      {rateLimitInfo && tokenPercentage > 50 && (
        <div className="flex items-center justify-between px-4 py-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
              Token utilizzati: {Math.round(tokenPercentage)}%
            </span>
          </div>
          <span className="text-xs text-amber-600 dark:text-amber-400">
            Reset tra {timeUntilReset}s
          </span>
        </div>
      )}
      <div className="relative bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 focus-within:border-cyan-400 dark:focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-100 dark:focus-within:ring-cyan-900/30 focus-within:shadow-[0_0_15px_rgba(6,182,212,0.15)]">
        <div className="flex gap-2 items-end p-3">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isProcessing ? "L'assistente sta scrivendo... (puoi continuare a scrivere)" : "Scrivi un messaggio..."}
              disabled={disabled}
              className="resize-none min-h-[40px] max-h-[100px] bg-transparent border-0 focus:ring-0 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0"
              rows={1}
            />
          </div>
          {onLiveModeClick && (
            <Button
              onClick={handleLiveModeClick}
              disabled={cannotSend}
              size="icon"
              variant="outline"
              className="flex-shrink-0 h-10 w-10 border border-red-200 dark:border-red-800 hover:bg-red-500 hover:border-red-500 hover:text-white disabled:border-slate-200 dark:disabled:border-slate-700 disabled:cursor-not-allowed transition-all duration-200 rounded-xl group"
              title="Modalità Live Vocale"
            >
              <Mic className="h-4 w-4 text-red-500 group-hover:text-white transition-colors" />
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || cannotSend}
            size="icon"
            className="flex-shrink-0 h-10 w-10 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-600 hover:to-teal-600 disabled:bg-slate-200 dark:disabled:bg-slate-700 disabled:cursor-not-allowed transition-all duration-200 rounded-xl group shadow-sm hover:shadow-md"
          >
            {isProcessing ? (
              <div className="flex gap-0.5">
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            ) : (
              <Send className="h-4 w-4 text-white transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
