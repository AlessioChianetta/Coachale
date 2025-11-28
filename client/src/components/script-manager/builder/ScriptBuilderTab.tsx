import React from 'react';
import { BuilderProvider, useBuilder } from './BuilderContext';
import { BlockPalette } from './BlockPalette';
import { BuilderCanvas } from './BuilderCanvas';
import { BlockInspector } from './BlockInspector';
import { ModeSelector } from './ModeSelector';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RotateCcw, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScriptBuilderTabProps {
  onSave: (structure: ReturnType<ReturnType<typeof useBuilder>['toStructure']>, scriptType: string, scriptName: string) => Promise<void>;
  isSaving?: boolean;
}

function ScriptBuilderContent({ onSave, isSaving }: ScriptBuilderTabProps) {
  const builder = useBuilder();

  const handleSave = async () => {
    const structure = builder.toStructure();
    await onSave(structure, builder.scriptType, builder.scriptName);
    builder.setIsDirty(false);
  };

  const handleReset = () => {
    if (builder.isDirty) {
      if (!confirm('Hai modifiche non salvate. Vuoi davvero ricominciare da zero?')) {
        return;
      }
    }
    builder.reset();
  };

  return (
    <div className="flex flex-col h-full bg-muted/30">
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" />
            <span className="font-semibold">Script Builder</span>
          </div>
          <Input
            value={builder.scriptName}
            onChange={(e) => builder.setScriptName(e.target.value)}
            className="h-8 w-64 text-sm"
            placeholder="Nome script..."
          />
          {builder.isDirty && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              Non salvato
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <ModeSelector />
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !builder.isDirty || builder.phases.length === 0}
          >
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salva Script
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <div className="w-[220px] border-r bg-background overflow-y-auto">
          <BlockPalette />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <BuilderCanvas />
        </div>

        <div className="w-[320px] border-l bg-background overflow-y-auto">
          <BlockInspector />
        </div>
      </div>

      {builder.error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 text-destructive text-sm">
          {builder.error}
        </div>
      )}
    </div>
  );
}

export function ScriptBuilderTab(props: ScriptBuilderTabProps) {
  return (
    <BuilderProvider>
      <ScriptBuilderContent {...props} />
    </BuilderProvider>
  );
}
