import { Pencil, FileText, Sparkles } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { BuilderMode } from '../index';

interface ModeSelectorProps {
  mode: BuilderMode;
  onModeChange: (mode: BuilderMode) => void;
}

export function ModeSelector({ mode, onModeChange }: ModeSelectorProps) {
  return (
    <TooltipProvider>
      <Tabs value={mode} onValueChange={(v) => onModeChange(v as BuilderMode)}>
        <TabsList className="h-9">
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="manual" className="gap-1.5 px-3">
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Manuale</span>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Crea lo script manualmente blocco per blocco</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="template" className="gap-1.5 px-3">
                <FileText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Template</span>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">Parti da un template predefinito</p>
            </TooltipContent>
          </Tooltip>
          
          <Tooltip>
            <TooltipTrigger asChild>
              <TabsTrigger value="ai-assisted" className="gap-1.5 px-3">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI</span>
              </TabsTrigger>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p className="text-xs">L'AI adatta il template per il tuo agente</p>
            </TooltipContent>
          </Tooltip>
        </TabsList>
      </Tabs>
    </TooltipProvider>
  );
}
