import { useState, ReactNode } from 'react';
import { ChevronDown, ChevronRight, Edit3, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BlockType, BLOCK_COLORS, BLOCK_ICONS, BLOCK_LABELS } from '@shared/script-blocks';

interface BlockContainerProps {
  type: BlockType;
  title?: string;
  customIcon?: string;
  children: ReactNode;
  isEditing?: boolean;
  defaultExpanded?: boolean;
  onEdit?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  className?: string;
  headerExtra?: ReactNode;
  nested?: boolean;
}

export function BlockContainer({
  type,
  title,
  customIcon,
  children,
  isEditing = false,
  defaultExpanded = true,
  onEdit,
  onSave,
  onCancel,
  className,
  headerExtra,
  nested = false,
}: BlockContainerProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const colorClasses = BLOCK_COLORS[type];
  const icon = customIcon || BLOCK_ICONS[type];
  const label = BLOCK_LABELS[type];
  const displayTitle = title || label;

  const borderColorMap: Record<BlockType, string> = {
    metadata: 'border-l-slate-400',
    globalRule: 'border-l-red-400',
    phase: 'border-l-blue-400',
    energy: 'border-l-yellow-400',
    step: 'border-l-green-400',
    question: 'border-l-purple-400',
    biscottino: 'border-l-amber-400',
    checkpoint: 'border-l-orange-400',
    ladder: 'border-l-indigo-400',
    resistance: 'border-l-rose-400',
    transition: 'border-l-cyan-400',
    objection: 'border-l-pink-400',
    reframe: 'border-l-teal-400',
  };

  return (
    <div
      className={cn(
        'rounded-lg border-l-4 transition-all duration-200',
        colorClasses,
        borderColorMap[type],
        nested ? 'ml-4' : '',
        className
      )}
    >
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <div className="flex items-center justify-between p-3 gap-2">
          <CollapsibleTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 justify-start gap-2 h-auto py-1 px-2 hover:bg-transparent"
            >
              {isExpanded ? (
                <ChevronDown className="h-4 w-4 shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0" />
              )}
              <span className="text-lg">{icon}</span>
              <span className="font-medium text-sm truncate">{displayTitle}</span>
              <Badge variant="outline" className="ml-2 text-xs shrink-0">
                {label}
              </Badge>
            </Button>
          </CollapsibleTrigger>
          
          <div className="flex items-center gap-1 shrink-0">
            {headerExtra}
            {isEditing ? (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onCancel}
                >
                  <X className="h-4 w-4 text-muted-foreground" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onSave}
                >
                  <Save className="h-4 w-4 text-green-600" />
                </Button>
              </>
            ) : (
              onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onEdit}
                >
                  <Edit3 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )
            )}
          </div>
        </div>
        
        <CollapsibleContent className="transition-all duration-200 ease-in-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0">
          <div className="px-4 pb-4 pt-0">
            {children}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
