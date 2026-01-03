import { useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { useLocation } from "wouter";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { 
  Send, 
  Mic, 
  Plus, 
  Image, 
  FileText, 
  X,
  ChevronDown,
  Brain,
  Sparkles,
  Zap
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type AIModel = "gemini-3-flash-preview" | "gemini-3-pro-preview";
export type ThinkingLevel = "low" | "medium" | "high";

export interface AttachedFile {
  id: string;
  file: File;
  preview?: string;
  type: "image" | "document";
}

interface InputAreaProps {
  onSend: (message: string, files?: AttachedFile[], model?: AIModel, thinkingLevel?: ThinkingLevel) => void;
  disabled?: boolean;
  isProcessing?: boolean;
  onLiveModeClick?: () => void;
  rateLimitInfo?: {
    tokensUsed: number;
    resetAt: number;
    isWaiting: boolean;
  };
  selectedModel?: AIModel;
  onModelChange?: (model: AIModel) => void;
  thinkingLevel?: ThinkingLevel;
  onThinkingLevelChange?: (level: ThinkingLevel) => void;
}

const MODEL_INFO = {
  "gemini-3-flash-preview": {
    name: "Flash 3",
    description: "Veloce con pensiero",
    icon: Zap,
    supportsThinking: true,
  },
  "gemini-3-pro-preview": {
    name: "Pro 3",
    description: "Massima potenza + pensiero",
    icon: Brain,
    supportsThinking: true,
  },
};

const THINKING_LEVELS = {
  low: { label: "Basso", description: "Risposte rapide" },
  medium: { label: "Medio", description: "Bilanciato" },
  high: { label: "Alto", description: "Ragionamento profondo" },
};

export function InputArea({ 
  onSend, 
  disabled = false, 
  isProcessing = false, 
  onLiveModeClick, 
  rateLimitInfo,
  selectedModel = "gemini-3-flash-preview",
  onModelChange,
  thinkingLevel = "low",
  onThinkingLevelChange,
}: InputAreaProps) {
  const cannotSend = disabled || isProcessing;
  const [message, setMessage] = useState("");
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [, setLocation] = useLocation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const currentModel = MODEL_INFO[selectedModel];
  const supportsThinking = currentModel.supportsThinking;

  const handleSend = () => {
    if ((message.trim() || attachedFiles.length > 0) && !cannotSend) {
      onSend(message.trim(), attachedFiles.length > 0 ? attachedFiles : undefined, selectedModel, thinkingLevel);
      setMessage("");
      setAttachedFiles([]);
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

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>, type: "image" | "document") => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      const id = Math.random().toString(36).substring(7);
      const newFile: AttachedFile = {
        id,
        file,
        type,
      };

      if (type === "image" && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newFile.preview = e.target?.result as string;
          setAttachedFiles((prev) => [...prev, newFile]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedFiles((prev) => [...prev, newFile]);
      }
    });

    e.target.value = "";
    setShowAttachMenu(false);
  };

  const removeFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const tokenPercentage = rateLimitInfo ? (rateLimitInfo.tokensUsed / 245000) * 100 : 0;
  const timeUntilReset = rateLimitInfo ? Math.max(0, Math.ceil((rateLimitInfo.resetAt - Date.now()) / 1000)) : 0;

  return (
    <div className="space-y-3 max-w-3xl mx-auto">
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

      {attachedFiles.length > 0 && (
        <div className="flex flex-wrap gap-2 px-1">
          {attachedFiles.map((file) => (
            <div
              key={file.id}
              className="relative group flex items-center gap-2 px-3 py-2 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700"
            >
              {file.type === "image" && file.preview ? (
                <img src={file.preview} alt="" className="w-8 h-8 rounded object-cover" />
              ) : (
                <FileText className="w-5 h-5 text-slate-500" />
              )}
              <span className="text-sm text-slate-700 dark:text-slate-300 max-w-[120px] truncate">
                {file.file.name}
              </span>
              <button
                onClick={() => removeFile(file.id)}
                className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all duration-300 focus-within:border-slate-300 dark:focus-within:border-slate-600 focus-within:bg-white dark:focus-within:bg-slate-800">
        <div className="px-4 pt-3 pb-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isProcessing ? "Sto elaborando..." : "Chiedi qualcosa..."}
            disabled={disabled}
            className="resize-none min-h-[44px] max-h-[120px] bg-transparent border-0 focus:ring-0 focus:outline-none focus-visible:ring-0 disabled:opacity-60 disabled:cursor-not-allowed text-base placeholder:text-slate-400 dark:placeholder:text-slate-500 p-0 shadow-none"
            rows={1}
          />
        </div>

        <div className="flex items-center justify-between px-3 pb-3 pt-1 border-t border-slate-100 dark:border-slate-700/50">
          <div className="flex items-center gap-1">
            <Popover open={showAttachMenu} onOpenChange={setShowAttachMenu}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                  disabled={cannotSend}
                >
                  <Plus className="h-5 w-5 text-slate-500" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="start">
                <button
                  onClick={() => imageInputRef.current?.click()}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Image className="w-4 h-4" />
                  Carica immagine
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <FileText className="w-4 h-4" />
                  Carica documento
                </button>
              </PopoverContent>
            </Popover>

            {supportsThinking && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                  >
                    <Brain className="h-4 w-4" />
                    <span className="text-xs font-medium">{THINKING_LEVELS[thinkingLevel].label}</span>
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48">
                  <DropdownMenuLabel className="text-xs text-slate-500">Livello di pensiero</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {(Object.entries(THINKING_LEVELS) as [ThinkingLevel, typeof THINKING_LEVELS.low][]).map(([level, info]) => (
                    <DropdownMenuItem
                      key={level}
                      onClick={() => onThinkingLevelChange?.(level)}
                      className={cn(
                        "flex flex-col items-start gap-0.5 cursor-pointer",
                        thinkingLevel === level && "bg-slate-100 dark:bg-slate-800"
                      )}
                    >
                      <span className="font-medium">{info.label}</span>
                      <span className="text-xs text-slate-500">{info.description}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1.5 px-2 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400"
                >
                  <currentModel.icon className="h-4 w-4" />
                  <span className="text-xs font-medium">{currentModel.name}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="text-xs text-slate-500">Seleziona modello</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {(Object.entries(MODEL_INFO) as [AIModel, typeof MODEL_INFO["gemini-3-flash-preview"]][]).map(([model, info]) => (
                  <DropdownMenuItem
                    key={model}
                    onClick={() => onModelChange?.(model)}
                    className={cn(
                      "flex items-center gap-3 cursor-pointer",
                      selectedModel === model && "bg-slate-100 dark:bg-slate-800"
                    )}
                  >
                    <info.icon className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{info.name}</span>
                      <span className="text-xs text-slate-500">{info.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {onLiveModeClick && (
              <Button
                onClick={handleLiveModeClick}
                disabled={cannotSend}
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 group"
                title="Modalità Live Vocale"
              >
                <Mic className="h-4 w-4 text-red-500" />
              </Button>
            )}

            <Button
              onClick={handleSend}
              disabled={(!message.trim() && attachedFiles.length === 0) || cannotSend}
              size="sm"
              className="h-8 w-8 p-0 rounded-lg bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-100 disabled:bg-slate-200 dark:disabled:bg-slate-700 transition-all"
            >
              {isProcessing ? (
                <div className="flex gap-0.5">
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1 h-1 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              ) : (
                <Send className="h-4 w-4 text-white dark:text-slate-900" />
              )}
            </Button>
          </div>
        </div>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e, "image")}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
        multiple
        className="hidden"
        onChange={(e) => handleFileSelect(e, "document")}
      />
    </div>
  );
}
