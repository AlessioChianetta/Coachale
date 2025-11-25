import { useState, KeyboardEvent } from "react";
import { useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Send, Sparkles, Mic } from "lucide-react";

interface InputAreaProps {
  onSend: (message: string) => void;
  disabled: boolean;
  onLiveModeClick?: () => void;
  rateLimitInfo?: {
    tokensUsed: number;
    resetAt: number;
    isWaiting: boolean;
  };
}

export function InputArea({ onSend, disabled, onLiveModeClick, rateLimitInfo }: InputAreaProps) {
  const [message, setMessage] = useState("");
  const [, setLocation] = useLocation();

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleLiveModeClick = () => {
    if (!disabled) {
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
      <div className="relative bg-white dark:bg-gray-800 rounded-2xl border-2 border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 focus-within:border-blue-400 dark:focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-100 dark:focus-within:ring-blue-900/30">
        <div className="flex gap-3 items-end p-3 sm:p-4">
          <div className="flex-1 relative">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={disabled ? "L'assistente sta scrivendo..." : "Scrivi un messaggio..."}
              disabled={disabled}
              className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-0 focus:ring-0 focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed text-sm sm:text-base placeholder:text-gray-400 dark:placeholder:text-gray-500 p-0"
              rows={1}
            />
            {!message.trim() && !disabled && (
              <div className="absolute bottom-0 right-0 text-[10px] text-gray-400 dark:text-gray-600 pointer-events-none">
                Premi Invio per inviare
              </div>
            )}
          </div>
          {onLiveModeClick && (
            <Button
              onClick={handleLiveModeClick}
              disabled={disabled}
              size="icon"
              variant="outline"
              className="flex-shrink-0 h-11 w-11 min-h-[44px] min-w-[44px] sm:h-12 sm:w-12 border-2 border-red-500 hover:bg-red-500 hover:text-white disabled:border-gray-300 dark:disabled:border-gray-700 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl hover:scale-105 active:scale-95 group"
              title="Modalità Live Vocale"
            >
              <Mic className="h-4 w-4 sm:h-5 sm:w-5 text-red-500 group-hover:text-white transition-colors" />
            </Button>
          )}
          <Button
            onClick={handleSend}
            disabled={!message.trim() || disabled}
            size="icon"
            className="flex-shrink-0 h-11 w-11 min-h-[44px] min-w-[44px] sm:h-12 sm:w-12 bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-600 hover:from-blue-700 hover:via-blue-700 hover:to-cyan-700 disabled:from-gray-300 disabled:to-gray-400 dark:disabled:from-gray-700 dark:disabled:to-gray-800 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-200 rounded-xl hover:scale-105 active:scale-95 group"
          >
            {disabled ? (
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
              </div>
            ) : (
              <Send className="h-4 w-4 sm:h-5 sm:w-5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            )}
          </Button>
        </div>
        {message.trim() && (
          <div className="px-4 pb-3 flex items-center gap-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>
            <span className="text-[10px] text-gray-400 dark:text-gray-600">
              {message.length} caratteri
            </span>
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-700 to-transparent"></div>
          </div>
        )}
      </div>
    </div>
  );
}
