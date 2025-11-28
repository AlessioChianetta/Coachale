import { useState } from 'react';
import { 
  Target, 
  CheckSquare, 
  MessageSquare, 
  Zap, 
  Layers,
  Cookie,
  AlertOctagon,
  AlertTriangle,
  GripVertical,
  ChevronDown,
  ChevronRight,
  Plus
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Collapsible, 
  CollapsibleContent, 
  CollapsibleTrigger 
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { BLOCK_COLORS, BLOCK_ICONS, BLOCK_LABELS, type BlockType } from '@shared/script-blocks';

interface BlockPaletteProps {
  onAddBlock: (type: 'phase' | 'step' | 'question', parentId?: string) => void;
  selectedPhaseId?: string | null;
  selectedStepId?: string | null;
}

interface PaletteBlock {
  type: BlockType;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
  category: 'structure' | 'content' | 'behavior';
  canAdd: boolean;
  addType?: 'phase' | 'step' | 'question';
  requiresParent?: 'phase' | 'step';
}

const paletteBlocks: PaletteBlock[] = [
  {
    type: 'phase',
    label: 'Fase',
    icon: <Target className="h-4 w-4" />,
    description: 'Sezione principale dello script',
    color: 'bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400',
    category: 'structure',
    canAdd: true,
    addType: 'phase'
  },
  {
    type: 'step',
    label: 'Step',
    icon: <CheckSquare className="h-4 w-4" />,
    description: 'Passaggio dentro una fase',
    color: 'bg-green-500/10 border-green-500/30 text-green-600 dark:text-green-400',
    category: 'structure',
    canAdd: true,
    addType: 'step',
    requiresParent: 'phase'
  },
  {
    type: 'question',
    label: 'Domanda',
    icon: <MessageSquare className="h-4 w-4" />,
    description: 'Domanda da porre al prospect',
    color: 'bg-purple-500/10 border-purple-500/30 text-purple-600 dark:text-purple-400',
    category: 'content',
    canAdd: true,
    addType: 'question',
    requiresParent: 'step'
  },
  {
    type: 'energy',
    label: 'Energia',
    icon: <Zap className="h-4 w-4" />,
    description: 'Impostazioni tonalità e ritmo',
    color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-400',
    category: 'behavior',
    canAdd: false
  },
  {
    type: 'ladder',
    label: 'Ladder',
    icon: <Layers className="h-4 w-4" />,
    description: 'Scala dei perché per approfondire',
    color: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400',
    category: 'behavior',
    canAdd: false
  },
  {
    type: 'biscottino',
    label: 'Biscottino',
    icon: <Cookie className="h-4 w-4" />,
    description: 'Frase per riportare focus',
    color: 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400',
    category: 'content',
    canAdd: false
  },
  {
    type: 'checkpoint',
    label: 'Checkpoint',
    icon: <AlertOctagon className="h-4 w-4" />,
    description: 'Verifica prima di procedere',
    color: 'bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400',
    category: 'behavior',
    canAdd: false
  },
  {
    type: 'globalRule',
    label: 'Regola Globale',
    icon: <AlertTriangle className="h-4 w-4" />,
    description: 'Regola critica da seguire sempre',
    color: 'bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400',
    category: 'behavior',
    canAdd: false
  },
];

const categories = [
  { id: 'structure', label: 'Struttura', description: 'Blocchi base dello script' },
  { id: 'content', label: 'Contenuto', description: 'Elementi di contenuto' },
  { id: 'behavior', label: 'Comportamento', description: 'Regole e dinamiche' },
];

export function BlockPalette({ onAddBlock, selectedPhaseId, selectedStepId }: BlockPaletteProps) {
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['structure', 'content', 'behavior']);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => 
      prev.includes(categoryId) 
        ? prev.filter(c => c !== categoryId)
        : [...prev, categoryId]
    );
  };

  const handleAddBlock = (block: PaletteBlock) => {
    if (!block.canAdd || !block.addType) return;
    
    if (block.requiresParent === 'phase' && !selectedPhaseId) {
      return;
    }
    if (block.requiresParent === 'step' && !selectedStepId) {
      return;
    }
    
    const parentId = block.requiresParent === 'phase' ? selectedPhaseId : 
                     block.requiresParent === 'step' ? selectedStepId : undefined;
    
    onAddBlock(block.addType, parentId || undefined);
  };

  const canAddBlock = (block: PaletteBlock): boolean => {
    if (!block.canAdd) return false;
    if (block.requiresParent === 'phase' && !selectedPhaseId) return false;
    if (block.requiresParent === 'step' && !selectedStepId) return false;
    return true;
  };

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b">
        <h2 className="font-semibold text-sm">Blocchi</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Clicca per aggiungere al canvas
        </p>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-3 space-y-3">
          {categories.map(category => {
            const categoryBlocks = paletteBlocks.filter(b => b.category === category.id);
            const isExpanded = expandedCategories.includes(category.id);
            
            return (
              <Collapsible 
                key={category.id} 
                open={isExpanded}
                onOpenChange={() => toggleCategory(category.id)}
              >
                <CollapsibleTrigger className="flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <span>{category.label}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  )}
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-1 mt-1">
                  {categoryBlocks.map(block => {
                    const isAddable = canAddBlock(block);
                    
                    return (
                      <div
                        key={block.type}
                        onClick={() => isAddable && handleAddBlock(block)}
                        className={cn(
                          'group flex items-center gap-2 p-2 rounded-lg border transition-all',
                          block.color,
                          isAddable 
                            ? 'cursor-pointer hover:scale-[1.02] hover:shadow-sm active:scale-[0.98]' 
                            : 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-background/50">
                          {block.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">
                              {block.label}
                            </span>
                            {isAddable && (
                              <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {block.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      </ScrollArea>
      
      <div className="p-3 border-t bg-muted/50">
        <div className="text-[10px] text-muted-foreground space-y-1">
          {selectedPhaseId && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0">Fase</Badge>
              <span>selezionata</span>
            </div>
          )}
          {selectedStepId && (
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-[9px] px-1 py-0">Step</Badge>
              <span>selezionato</span>
            </div>
          )}
          {!selectedPhaseId && !selectedStepId && (
            <span>Seleziona un blocco per aggiungere elementi</span>
          )}
        </div>
      </div>
    </div>
  );
}
