import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Save, 
  Undo2, 
  Redo2, 
  Eye, 
  Settings2,
  Wand2,
  FileText,
  Pencil,
  Sparkles,
  Menu,
  ArrowLeft
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import Sidebar from '@/components/sidebar';
import { BlockPalette } from './components/BlockPalette';
import { BuilderCanvas } from './components/BuilderCanvas';
import { BlockInspector } from './components/BlockInspector';
import { ModeSelector } from './components/ModeSelector';
import { TemplatePicker } from './components/TemplatePicker';
import { AIAssistantDialog } from './components/AIAssistantDialog';
import type { Phase, Step, Question, ScriptBlockStructure } from '@shared/script-blocks';

export type BuilderMode = 'manual' | 'template' | 'ai-assisted';
export type ScriptType = 'discovery' | 'demo' | 'objections';

export interface BuilderBlock {
  id: string;
  type: 'phase' | 'step' | 'question' | 'energy' | 'ladder' | 'biscottino' | 'checkpoint' | 'globalRule';
  data: any;
  children?: BuilderBlock[];
}

const emptyStructure: ScriptBlockStructure = {
  metadata: {
    name: 'Nuovo Script',
    type: 'discovery',
    version: '1.0.0',
  },
  globalRules: [],
  phases: [],
};

export default function ScriptBuilder() {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [mode, setMode] = useState<BuilderMode>('manual');
  const [scriptType, setScriptType] = useState<ScriptType>('discovery');
  const [scriptName, setScriptName] = useState('Nuovo Script');
  const [structure, setStructure] = useState<ScriptBlockStructure>(emptyStructure);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [showInspector, setShowInspector] = useState(true);

  const findBlockById = useCallback((id: string): any => {
    for (const phase of structure.phases) {
      if (phase.id === id) return { block: phase, type: 'phase' };
      for (const step of phase.steps || []) {
        if (step.id === id) return { block: step, type: 'step', parentPhase: phase };
        for (const question of step.questions || []) {
          if (question.id === id) return { block: question, type: 'question', parentStep: step, parentPhase: phase };
        }
      }
    }
    return null;
  }, [structure]);

  const selectedBlock = selectedBlockId ? findBlockById(selectedBlockId) : null;

  const handleModeChange = (newMode: BuilderMode) => {
    if (newMode === 'template') {
      setShowTemplatePicker(true);
    } else if (newMode === 'ai-assisted') {
      setShowAIDialog(true);
    } else {
      setMode(newMode);
      setStructure({
        ...emptyStructure,
        metadata: { ...emptyStructure.metadata, type: scriptType }
      });
    }
  };

  const handleTemplateSelect = (template: ScriptBlockStructure, type: ScriptType) => {
    setStructure(template);
    setScriptType(type);
    setMode('template');
    setShowTemplatePicker(false);
    setIsDirty(true);
    toast({ title: 'Template caricato', description: 'Puoi ora modificare il template' });
  };

  const handleAIGenerate = (generatedStructure: ScriptBlockStructure) => {
    setStructure(generatedStructure);
    setMode('ai-assisted');
    setShowAIDialog(false);
    setIsDirty(true);
    toast({ title: 'Script generato', description: 'L\'AI ha adattato lo script per il tuo agente' });
  };

  const handleBlockSelect = (blockId: string | null) => {
    setSelectedBlockId(blockId);
    if (blockId && isMobile) {
      setShowInspector(true);
    }
  };

  const handleBlockUpdate = (blockId: string, updates: any) => {
    setStructure(prev => {
      const newPhases = prev.phases.map(phase => {
        if (phase.id === blockId) {
          return { ...phase, ...updates };
        }
        return {
          ...phase,
          steps: (phase.steps || []).map(step => {
            if (step.id === blockId) {
              return { ...step, ...updates };
            }
            return {
              ...step,
              questions: (step.questions || []).map(q => 
                q.id === blockId ? { ...q, ...updates } : q
              )
            };
          })
        };
      });
      return { ...prev, phases: newPhases };
    });
    setIsDirty(true);
  };

  const handleAddBlock = (type: 'phase' | 'step' | 'question', parentId?: string) => {
    const newId = `${type}_${crypto.randomUUID().slice(0, 8)}`;
    
    setStructure(prev => {
      if (type === 'phase') {
        const newPhase: Phase = {
          id: newId,
          type: 'phase',
          number: String(prev.phases.length + 1),
          name: 'Nuova Fase',
          description: '',
          steps: []
        };
        return { ...prev, phases: [...prev.phases, newPhase] };
      }
      
      if (type === 'step' && parentId) {
        const newStep: Step = {
          id: newId,
          type: 'step',
          number: 1,
          name: 'Nuovo Step',
          objective: '',
          questions: []
        };
        return {
          ...prev,
          phases: prev.phases.map(p => 
            p.id === parentId 
              ? { ...p, steps: [...(p.steps || []), { ...newStep, number: (p.steps?.length || 0) + 1 }] }
              : p
          )
        };
      }
      
      if (type === 'question' && parentId) {
        const newQuestion: Question = {
          id: newId,
          type: 'question',
          text: 'Nuova domanda...'
        };
        return {
          ...prev,
          phases: prev.phases.map(p => ({
            ...p,
            steps: (p.steps || []).map(s =>
              s.id === parentId
                ? { ...s, questions: [...(s.questions || []), newQuestion] }
                : s
            )
          }))
        };
      }
      
      return prev;
    });
    
    setSelectedBlockId(newId);
    setIsDirty(true);
  };

  const handleDeleteBlock = (blockId: string) => {
    setStructure(prev => {
      let newPhases = prev.phases.filter(p => p.id !== blockId);
      newPhases = newPhases.map(p => ({
        ...p,
        steps: (p.steps || []).filter(s => s.id !== blockId).map(s => ({
          ...s,
          questions: (s.questions || []).filter(q => q.id !== blockId)
        }))
      }));
      return { ...prev, phases: newPhases };
    });
    
    if (selectedBlockId === blockId) {
      setSelectedBlockId(null);
    }
    setIsDirty(true);
  };

  const handleMoveBlock = (blockId: string, direction: 'up' | 'down') => {
    setStructure(prev => {
      const phaseIndex = prev.phases.findIndex(p => p.id === blockId);
      if (phaseIndex !== -1) {
        const newPhases = [...prev.phases];
        const targetIndex = direction === 'up' ? phaseIndex - 1 : phaseIndex + 1;
        if (targetIndex >= 0 && targetIndex < newPhases.length) {
          [newPhases[phaseIndex], newPhases[targetIndex]] = [newPhases[targetIndex], newPhases[phaseIndex]];
          newPhases.forEach((p, i) => p.number = String(i + 1));
        }
        return { ...prev, phases: newPhases };
      }
      return prev;
    });
    setIsDirty(true);
  };

  const handleSave = async () => {
    toast({ title: 'Salvataggio...', description: 'Script in fase di salvataggio' });
    setIsDirty(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col">
        <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center gap-4 px-4">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            
            <Button variant="ghost" size="sm" asChild>
              <a href="/client/scripts">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Torna agli Script
              </a>
            </Button>
            
            <div className="flex-1 flex items-center gap-3">
              <h1 className="text-lg font-semibold hidden sm:block">Script Builder</h1>
              <Badge variant="outline" className={cn(
                scriptType === 'discovery' && 'border-blue-500 text-blue-600',
                scriptType === 'demo' && 'border-green-500 text-green-600',
                scriptType === 'objections' && 'border-orange-500 text-orange-600',
              )}>
                {scriptType === 'discovery' ? 'Discovery' : scriptType === 'demo' ? 'Demo' : 'Obiezioni'}
              </Badge>
              {isDirty && (
                <Badge variant="secondary" className="text-xs">
                  Non salvato
                </Badge>
              )}
            </div>
            
            <ModeSelector mode={mode} onModeChange={handleModeChange} />
            
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={!isDirty}>
                <Undo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" disabled={!isDirty}>
                <Redo2 className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm">
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!isDirty}>
                <Save className="h-4 w-4 mr-2" />
                Salva
              </Button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden">
          <ResizablePanelGroup direction="horizontal" className="h-full">
            <ResizablePanel defaultSize={15} minSize={12} maxSize={20}>
              <BlockPalette 
                onAddBlock={handleAddBlock}
                selectedPhaseId={selectedBlock?.type === 'phase' ? selectedBlockId : selectedBlock?.parentPhase?.id}
                selectedStepId={selectedBlock?.type === 'step' ? selectedBlockId : selectedBlock?.parentStep?.id}
              />
            </ResizablePanel>
            
            <ResizableHandle withHandle />
            
            <ResizablePanel defaultSize={showInspector ? 55 : 85}>
              <BuilderCanvas
                structure={structure}
                selectedBlockId={selectedBlockId}
                onSelectBlock={handleBlockSelect}
                onAddBlock={handleAddBlock}
                onDeleteBlock={handleDeleteBlock}
                onMoveBlock={handleMoveBlock}
                mode={mode}
              />
            </ResizablePanel>
            
            {showInspector && (
              <>
                <ResizableHandle withHandle />
                <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <BlockInspector
                    selectedBlock={selectedBlock}
                    onUpdate={handleBlockUpdate}
                    onClose={() => {
                      setSelectedBlockId(null);
                      if (isMobile) setShowInspector(false);
                    }}
                  />
                </ResizablePanel>
              </>
            )}
          </ResizablePanelGroup>
        </main>
      </div>

      <TemplatePicker
        open={showTemplatePicker}
        onOpenChange={setShowTemplatePicker}
        onSelect={handleTemplateSelect}
      />

      <AIAssistantDialog
        open={showAIDialog}
        onOpenChange={setShowAIDialog}
        onGenerate={handleAIGenerate}
        currentStructure={structure}
      />
    </div>
  );
}
