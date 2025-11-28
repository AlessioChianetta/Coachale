import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { BLOCK_COLORS, BLOCK_ICONS, BLOCK_LABELS, BlockType } from '@shared/script-blocks';
import { PALETTE_CATEGORIES } from './types';
import { cn } from '@/lib/utils';
import { GripVertical, Layers, MessageSquare, Settings } from 'lucide-react';

interface PaletteBlockProps {
  blockType: BlockType;
  onDragStart: (e: React.DragEvent, blockType: BlockType) => void;
}

function PaletteBlock({ blockType, onDragStart }: PaletteBlockProps) {
  const icon = BLOCK_ICONS[blockType];
  const label = BLOCK_LABELS[blockType];
  const colorClass = BLOCK_COLORS[blockType];

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/json', JSON.stringify({ blockType }));
    e.dataTransfer.effectAllowed = 'copy';
    onDragStart(e, blockType);
  };

  return (
    <div
      draggable
      onDragStart={handleDragStart}
      className={cn(
        'flex items-center gap-2 p-2 rounded-lg border cursor-grab transition-all',
        'hover:shadow-md hover:scale-[1.02] active:cursor-grabbing active:scale-[0.98]',
        colorClass
      )}
    >
      <GripVertical className="h-4 w-4 text-muted-foreground/50" />
      <span className="text-lg">{icon}</span>
      <span className="text-sm font-medium flex-1">{label}</span>
    </div>
  );
}

const CATEGORY_ICONS = {
  structure: <Layers className="h-4 w-4" />,
  content: <MessageSquare className="h-4 w-4" />,
  behavior: <Settings className="h-4 w-4" />,
};

export function BlockPalette() {
  const handleDragStart = (e: React.DragEvent, blockType: BlockType) => {
    const dragImage = document.createElement('div');
    dragImage.className = 'bg-primary text-primary-foreground px-3 py-1 rounded text-sm font-medium shadow-lg';
    dragImage.textContent = `${BLOCK_ICONS[blockType]} ${BLOCK_LABELS[blockType]}`;
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 0, 0);
    setTimeout(() => document.body.removeChild(dragImage), 0);
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-sm">Blocchi Disponibili</h3>
          <p className="text-xs text-muted-foreground">
            Trascina i blocchi nel canvas per costruire lo script
          </p>
        </div>

        {PALETTE_CATEGORIES.map((category) => (
          <Card key={category.id} className="shadow-none">
            <CardHeader className="p-3 pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                {CATEGORY_ICONS[category.id as keyof typeof CATEGORY_ICONS]}
                {category.label}
              </CardTitle>
              <CardDescription className="text-xs">
                {category.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 pt-0 space-y-2">
              {category.blocks.map((blockType) => (
                <PaletteBlock
                  key={blockType}
                  blockType={blockType}
                  onDragStart={handleDragStart}
                />
              ))}
            </CardContent>
          </Card>
        ))}

        <div className="pt-4 border-t">
          <h4 className="font-medium text-xs text-muted-foreground mb-2">LEGENDA</h4>
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span>📍</span>
              <span className="text-muted-foreground">Fase = macro-sezione</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🎯</span>
              <span className="text-muted-foreground">Step = sotto-sezione</span>
            </div>
            <div className="flex items-center gap-2">
              <span>📌</span>
              <span className="text-muted-foreground">Domanda = cosa chiedere</span>
            </div>
            <div className="flex items-center gap-2">
              <span>⚡</span>
              <span className="text-muted-foreground">Energia = tono voce</span>
            </div>
            <div className="flex items-center gap-2">
              <span>🔍</span>
              <span className="text-muted-foreground">Ladder = approfondimento</span>
            </div>
          </div>
        </div>
      </div>
    </ScrollArea>
  );
}
