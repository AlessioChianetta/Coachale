import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'wouter';
import {
  FileText,
  Save,
  Plus,
  X,
  Loader2,
  Menu,
  Play,
  Edit3,
  BookOpen,
  Info,
  Package,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Lightbulb,
  Trash2,
  Blocks,
  Code,
  Users,
  Bot
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  parseTextToBlocks, 
  blocksToText,
  type ScriptBlockStructure 
} from '@shared/script-parser';
import type { Phase, Step, Question, ScriptBlock } from '@shared/script-blocks';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { PhaseInspector } from '@/components/script-manager/PhaseInspector';
import { StepInspector } from '@/components/script-manager/StepInspector';
import { QuestionInspector } from '@/components/script-manager/QuestionInspector';
import { BlockEditor } from '@/components/script-manager/BlockEditor';
import { ScriptBuilderTab } from '@/components/script-manager/builder';
import { Wand2 } from 'lucide-react';

// Types and Constants
interface EnergySettingsData {
  level: 'BASSO' | 'MEDIO' | 'ALTO';
  tone: 'CALMO' | 'SICURO' | 'CONFIDENZIALE' | 'ENTUSIASTA';
  volume: 'SOFT' | 'NORMAL' | 'LOUD';
  pace: 'LENTO' | 'MODERATO' | 'VELOCE';
  vocabulary: 'FORMALE' | 'COLLOQUIALE' | 'TECNICO';
  reason?: string;
}

interface LadderLevel {
  level: number;
  text: string;
  purpose: string;
}

interface LadderData {
  hasLadder: boolean;
  levels: LadderLevel[];
}

interface QuestionData {
  id: string;
  text: string;
  order: number;
  type?: string;
}

interface SalesScript {
  id: string;
  name: string;
  scriptType: 'discovery' | 'demo' | 'objections';
  version: string;
  content: string;
  structure: {
    version: string;
    phases: Array<Phase>;
  };
  isActive: boolean;
  updatedAt: string;
  energySettings?: Record<string, EnergySettingsData>;
  ladderOverrides?: Record<string, LadderData>;
  stepQuestions?: Record<string, QuestionData[]>;
  stepBiscottini?: Record<string, Array<{ text: string; type: string }>>;
}

const scriptTypeLabels: Record<SalesScript['scriptType'], string> = {
  discovery: 'Discovery Call',
  demo: 'Demo Call',
  objections: 'Gestione Obiezioni',
};

const scriptTypeColors: Record<SalesScript['scriptType'], string> = {
  discovery: 'border-blue-500/50 bg-blue-500/5',
  demo: 'border-green-500/50 bg-green-500/5',
  objections: 'border-orange-500/50 bg-orange-500/5',
};

// Main Component
export default function ClientScriptManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // State Management
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SalesScript['scriptType']>('discovery');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedName, setEditedName] = useState('');
  const [blockStructure, setBlockStructure] = useState<ScriptBlockStructure | null>(null);
  const [editorMode, setEditorMode] = useState<'blocks' | 'text'>('blocks');
  const [parsingFailed, setParsingFailed] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ScriptBlock | null>(null);
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [newScriptType, setNewScriptType] = useState<'discovery' | 'demo' | 'objections'>('discovery');
  const [newScriptName, setNewScriptName] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [showGuideDialog, setShowGuideDialog] = useState(false);
  const [showAgentSelectDialog, setShowAgentSelectDialog] = useState(false);
  const [scriptToActivate, setScriptToActivate] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);

  // Types for agents with script assignments
  interface AgentWithAssignments {
    id: string;
    agentName: string;
    displayName: string;
    businessName: string;
    isActive: boolean;
    scriptAssignments: {
      discovery: { scriptId: string; scriptName: string } | null;
      demo: { scriptId: string; scriptName: string } | null;
      objections: { scriptId: string; scriptName: string } | null;
    };
  }

  // API Calls
  const { data: scripts = [], isLoading: isLoadingScripts } = useQuery<SalesScript[]>({
    queryKey: ['sales-scripts'],
    queryFn: async () => {
      const res = await fetch('/api/sales-scripts', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch scripts');
      return res.json();
    },
  });

  const { data: agents = [] } = useQuery<AgentWithAssignments[]>({
    queryKey: ['sales-scripts-agents'],
    queryFn: async () => {
      const res = await fetch('/api/sales-scripts/agents', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch agents');
      return res.json();
    },
  });

  const { data: selectedScript, isLoading: isLoadingScript, isError } = useQuery<SalesScript>({
    queryKey: ['sales-scripts', selectedScriptId],
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      const res = await fetch(`/api/sales-scripts/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch script details');
      return res.json();
    },
    enabled: !!selectedScriptId,
  });

  // 🔧 FIX: Accept structure in mutation to preserve block IDs
  const updateScriptMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; content?: string; structure?: ScriptBlockStructure }) => {
      const res = await fetch(`/api/sales-scripts/${data.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save script');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setIsEditing(false);
      toast({ title: 'Script salvato', description: 'Le modifiche sono state salvate.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const activateScriptMutation = useMutation({
    mutationFn: async ({ scriptId, agentId }: { scriptId: string; agentId: string }) => {
      const res = await fetch(`/api/sales-scripts/${scriptId}/activate`, { 
        method: 'POST', 
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore nell\'attivazione');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['sales-scripts-agents'] });
      setShowAgentSelectDialog(false);
      setScriptToActivate(null);
      toast({ 
        title: 'Script attivato', 
        description: `Lo script è ora attivo per l'agente "${data.agent?.name || 'selezionato'}".` 
      });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; scriptType: string }) => {
      const res = await fetch('/api/sales-scripts/create-from-template', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nella creazione');
      return res.json();
    },
    onSuccess: (newScript) => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setSelectedScriptId(newScript.id);
      setShowNewScriptDialog(false);
      setNewScriptName('');
      setUseTemplate(true);
      toast({ title: 'Script creato', description: 'Lo script è stato creato dal template di base' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const res = await fetch(`/api/sales-scripts/${scriptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nell\'eliminazione');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setSelectedScriptId(null);
      toast({ title: 'Script eliminato', description: 'Lo script è stato eliminato' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateEnergyMutation = useMutation({
    mutationFn: async (data: { scriptId: string; phaseOrStepId: string; settings: EnergySettingsData }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/energy`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseOrStepId: data.phaseOrStepId, settings: data.settings }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio energy');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Energy salvato', description: 'Le impostazioni energia sono state aggiornate.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateLadderMutation = useMutation({
    mutationFn: async (data: { scriptId: string; stepId: string; hasLadder: boolean; levels: LadderLevel[] }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/ladder`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: data.stepId, hasLadder: data.hasLadder, levels: data.levels }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio ladder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Ladder salvato', description: 'I livelli ladder sono stati aggiornati.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateQuestionsMutation = useMutation({
    mutationFn: async (data: { scriptId: string; stepId: string; questions: QuestionData[] }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/questions`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: data.stepId, questions: data.questions }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio domande');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Domande salvate', description: 'Le domande sono state aggiornate.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateBiscottiniMutation = useMutation({
    mutationFn: async (data: { scriptId: string; stepId: string; biscottini: Array<{ text: string; type: string }> }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/biscottini`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: data.stepId, biscottini: data.biscottini }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio biscottini');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Biscottini salvati', description: 'I biscottini sono stati aggiornati.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  // Handlers
  const handleBuilderSave = async (structure: ScriptBlockStructure, scriptType: string, scriptName: string) => {
    setIsSavingBuilder(true);
    try {
      const res = await fetch('/api/sales-scripts', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scriptName,
          scriptType,
          content: blocksToText(structure),
          structure,
          isActive: false,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore nella creazione dello script');
      }
      const newScript = await res.json();
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setShowBuilder(false);
      setSelectedScriptId(newScript.id);
      setActiveTab(scriptType as SalesScript['scriptType']);
      toast({ title: 'Script creato', description: 'Il nuovo script è stato salvato con successo.' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingBuilder(false);
    }
  };

  // 🔧 FIX: Save both content AND structure to preserve IDs
  const handleSave = () => {
    if (!selectedScriptId) return;
    const contentToSave = editorMode === 'blocks' && blockStructure ? blocksToText(blockStructure) : editedContent;
    
    // ✅ Send structure along with content to preserve IDs in DB
    const dataToSave: { id: string; name?: string; content?: string; structure?: ScriptBlockStructure } = { 
      id: selectedScriptId, 
      name: editedName, 
      content: contentToSave 
    };
    
    // Include structure if in blocks mode (this is the source of truth for IDs)
    if (editorMode === 'blocks' && blockStructure) {
      dataToSave.structure = blockStructure;
      console.log('💾 [ScriptManager] Saving with structure (IDs preserved):', 
        blockStructure.phases?.map(p => `${p.id}:${p.name}`).join(', '));
    }
    
    updateScriptMutation.mutate(dataToSave);
  };

  const handleSelectScript = (id: string) => {
    if (isEditing) {
      if (confirm('Hai modifiche non salvate. Sei sicuro di voler cambiare script?')) {
        setIsEditing(false);
      } else {
        return;
      }
    }
    
    // Se siamo in modalità builder, carica lo script nel builder
    if (showBuilder) {
      const scriptToLoad = scripts.find(s => s.id === id);
      if (scriptToLoad) {
        // Il caricamento effettivo avverrà tramite l'effect che monitora selectedScriptId
        setSelectedScriptId(id);
        setSelectedBlock(null);
      }
      return;
    }
    
    setSelectedScriptId(id);
    setSelectedBlock(null);
  };

  const handleBlockUpdate = useCallback((updatedBlock: ScriptBlock) => {
    if (!blockStructure) return;

    const newPhases = blockStructure.phases.map(phase => {
        if (phase.id === updatedBlock.id && updatedBlock.type === 'phase') return updatedBlock as Phase;
        
        const newSteps = (phase.steps || []).map(step => {
            if (step.id === updatedBlock.id && updatedBlock.type === 'step') return updatedBlock as Step;
            
            const newQuestions = (step.questions || []).map(q => 
                q.id === updatedBlock.id && updatedBlock.type === 'question' ? updatedBlock as Question : q
            );
            return { ...step, questions: newQuestions };
        });
        return { ...phase, steps: newSteps };
    });

    setBlockStructure({ ...blockStructure, phases: newPhases });
    setSelectedBlock(updatedBlock);
  }, [blockStructure]);

  const handleBlockAdd = useCallback((type: 'phase' | 'step' | 'question', parentId?: string) => {
    if (!blockStructure) return;
    
    let newBlock: ScriptBlock | null = null;
    let newPhases = [...blockStructure.phases];

    if (type === 'phase') {
      const maxPhaseNum = Math.max(0, ...newPhases.map(p => parseInt(p.number) || 0));
      newBlock = { id: `phase_${crypto.randomUUID()}`, type: 'phase', number: String(maxPhaseNum + 1), name: 'Nuova Fase', description: '', steps: [] };
      newPhases.push(newBlock as Phase);
    } else if (type === 'step' && parentId) {
      newPhases = newPhases.map(p => {
        if (p.id === parentId) {
          const maxStepNum = Math.max(0, ...(p.steps || []).map(s => s.number || 0));
          newBlock = { id: `step_${crypto.randomUUID()}`, type: 'step', number: maxStepNum + 1, name: 'Nuovo Step', objective: '', questions: [] };
          return { ...p, steps: [...(p.steps || []), newBlock as Step] };
        }
        return p;
      });
    } else if (type === 'question' && parentId) {
       newPhases = newPhases.map(p => ({
         ...p,
         steps: (p.steps || []).map(s => {
           if (s.id === parentId) {
             newBlock = { id: `question_${crypto.randomUUID()}`, type: 'question', text: 'Nuova domanda...' };
             return { ...s, questions: [...(s.questions || []), newBlock as Question] };
           }
           return s;
         })
       }));
    }

    setBlockStructure({ ...blockStructure, phases: newPhases });
    if(newBlock) setSelectedBlock(newBlock); // Select the new block
    toast({ title: 'Blocco Aggiunto', description: `Un nuovo blocco di tipo "${type}" è stato creato.`});

  }, [blockStructure, toast]);

  const handleBlockDelete = useCallback((blockId: string) => {
    if(!blockStructure) return;

    let newPhases = blockStructure.phases.filter(p => p.id !== blockId);
    newPhases = newPhases.map(p => {
        const newSteps = (p.steps || []).filter(s => s.id !== blockId);
        const stepsWithFilteredQuestions = newSteps.map(s => ({
            ...s,
            questions: (s.questions || []).filter(q => q.id !== blockId),
        }));
        return { ...p, steps: stepsWithFilteredQuestions };
    });

    setBlockStructure({ ...blockStructure, phases: newPhases });
    setSelectedBlock(null); // Deselect after deletion
    toast({ title: 'Blocco Eliminato', variant: 'destructive' });
  }, [blockStructure, toast]);


  // Effects
  // 🔧 FIX: Use structure from DB as source of truth (preserves IDs)
  // Only fall back to parseTextToBlocks for legacy scripts without structure
  useEffect(() => {
    if (selectedScript) {
      try {
        let parsed: ScriptBlockStructure | null = null;
        
        // ✅ OPTION A: Use saved structure if available (preserves IDs!)
        if (selectedScript.structure && 
            typeof selectedScript.structure === 'object' && 
            Array.isArray((selectedScript.structure as any).phases) &&
            (selectedScript.structure as any).phases.length > 0) {
          console.log('📦 [ScriptManager] Using saved structure from DB (IDs preserved)');
          parsed = selectedScript.structure as unknown as ScriptBlockStructure;
        } else if (selectedScript.content) {
          // Fallback: Parse from content for legacy scripts
          console.log('⚠️ [ScriptManager] No structure in DB, parsing from content (new IDs generated)');
          parsed = parseTextToBlocks(selectedScript.content, selectedScript.scriptType);
        }
        
        // Ensure all blocks have type property for editor
        if (parsed && parsed.phases) {
            parsed.phases.forEach(phase => {
                phase.type = 'phase';
                if (phase.steps) {
                    phase.steps.forEach(step => {
                        step.type = 'step';
                        if (step.questions) {
                            step.questions.forEach(question => {
                                question.type = 'question';
                            });
                        }
                    });
                }
            });
        }
        
        if (parsed && !parsed.metadata) {
          console.log('📦 [ScriptManager] Creating metadata from script info (was missing)');
          parsed.metadata = {
            name: selectedScript.name || 'Script',
            type: (selectedScript.scriptType as 'discovery' | 'demo' | 'objections') || 'discovery',
            version: '1.0.0',
          };
        }
        
        if (parsed && !parsed.globalRules) {
          parsed.globalRules = [];
        }
        
        setBlockStructure(parsed);
        setParsingFailed(!parsed || !parsed.phases?.length);
        setEditorMode((!parsed || !parsed.phases?.length) ? 'text' : 'blocks');
      } catch (err) {
        console.error('❌ [ScriptManager] Error loading script structure:', err);
        setBlockStructure(null);
        setParsingFailed(true);
        setEditorMode('text');
      }
      setEditedContent(selectedScript.content);
      setEditedName(selectedScript.name);
      setSelectedBlock(null);
    }
  }, [selectedScript]);

  // Carica lo script selezionato nel Builder quando è aperto
  useEffect(() => {
    if (showBuilder && selectedScript && blockStructure) {
      console.log('🔧 [Builder] Caricamento script esistente nel Builder:', selectedScript.name);
      // Il Builder Context espone un metodo loadFromStructure tramite BuilderContext
      // Questo verrà gestito passando la structure come prop al Builder
    }
  }, [showBuilder, selectedScript, blockStructure]);

  // Handlers for enhanced mutations
  const handleSaveEnergy = useCallback((phaseOrStepId: string, settings: EnergySettingsData) => {
    if (!selectedScriptId) return;
    updateEnergyMutation.mutate({ scriptId: selectedScriptId, phaseOrStepId, settings });
  }, [selectedScriptId, updateEnergyMutation]);

  const handleSaveLadder = useCallback((stepId: string, hasLadder: boolean, levels: LadderLevel[]) => {
    if (!selectedScriptId) return;
    updateLadderMutation.mutate({ scriptId: selectedScriptId, stepId, hasLadder, levels });
  }, [selectedScriptId, updateLadderMutation]);

  const handleSaveQuestions = useCallback((stepId: string, questions: QuestionData[]) => {
    if (!selectedScriptId) return;
    updateQuestionsMutation.mutate({ scriptId: selectedScriptId, stepId, questions });
  }, [selectedScriptId, updateQuestionsMutation]);

  // RENDER: Inspector Panel
  const renderInspector = () => {
    if (!selectedScriptId || !selectedScript) return <InspectorWelcomeMessage />;

    if (isEditing && selectedBlock) {
        switch (selectedBlock.type) {
            case 'phase': return (
              <PhaseInspector 
                phase={selectedBlock as Phase} 
                onUpdate={handleBlockUpdate} 
                isEditing 
                energySettings={selectedScript.energySettings?.[selectedBlock.id]}
                onSaveEnergy={(settings) => handleSaveEnergy(selectedBlock.id, settings)}
                isSavingEnergy={updateEnergyMutation.isPending}
              />
            );
            case 'step': return (
              <StepInspector 
                step={selectedBlock as Step} 
                onUpdate={handleBlockUpdate} 
                isEditing 
                energySettings={selectedScript.energySettings?.[selectedBlock.id]}
                ladderData={selectedScript.ladderOverrides?.[selectedBlock.id]}
                questionsData={selectedScript.stepQuestions?.[selectedBlock.id]}
                onSaveEnergy={(settings) => handleSaveEnergy(selectedBlock.id, settings)}
                onSaveLadder={(hasLadder, levels) => handleSaveLadder(selectedBlock.id, hasLadder, levels)}
                onSaveQuestions={(questions) => handleSaveQuestions(selectedBlock.id, questions)}
                isSavingEnergy={updateEnergyMutation.isPending}
                isSavingLadder={updateLadderMutation.isPending}
                isSavingQuestions={updateQuestionsMutation.isPending}
              />
            );
            case 'question': return <QuestionInspector question={selectedBlock as Question} onUpdate={handleBlockUpdate} isEditing />;
            default: return <div className="p-4 text-sm text-muted-foreground">Seleziona un blocco per visualizzarne i dettagli e modificarlo.</div>;
        }
    }
    
    return <ScriptDetailPanel script={selectedScript} />;
  };

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-4 py-2 bg-background z-10">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" /> Script Manager
              </h1>
              <Dialog open={showGuideDialog} onOpenChange={setShowGuideDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Guida</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Guida Completa allo Script Manager
                    </DialogTitle>
                    <DialogDescription>
                      Tutto quello che devi sapere per creare script di vendita efficaci per il tuo AI Sales Agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                      <h3 className="font-semibold text-lg mb-3">Struttura dello Script: FASI → STEP → DOMANDE</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary text-primary-foreground rounded px-2 py-1 font-mono text-xs">FASE</div>
                          <p className="text-muted-foreground">
                            Macro-sezione della conversazione (es. "Apertura", "Qualifica", "Presentazione"). 
                            Ogni fase raggruppa step correlati e ha i suoi obiettivi specifici.
                          </p>
                        </div>
                        <div className="flex items-start gap-3 pl-6">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 font-mono text-xs">STEP</div>
                          <p className="text-muted-foreground">
                            Sotto-fase con un obiettivo preciso. Contiene le domande da fare e le istruzioni comportamentali.
                            L'AI completa tutti gli step di una fase prima di passare alla successiva.
                          </p>
                        </div>
                        <div className="flex items-start gap-3 pl-12">
                          <div className="bg-green-500 text-white rounded px-2 py-1 font-mono text-xs">DOMANDA</div>
                          <p className="text-muted-foreground">
                            Domanda specifica da porre al prospect. L'AI le usa come guida ma le adatta al contesto della conversazione.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        🤖 Come l'AI Usa lo Script
                      </h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>L'AI Sales Agent riceve lo script completo nel suo contesto e lo usa per:</p>
                        <ul className="space-y-2 pl-4">
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Navigare la conversazione</strong>: Segue l'ordine FASE → STEP → DOMANDE senza saltare passaggi</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Adattare l'energia</strong>: Modifica tono, ritmo e volume in base alle impostazioni di ogni fase/step</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Attivare il Ladder</strong>: Quando il prospect dà risposte vaghe, l'AI scava più a fondo con i "Perché"</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Rispettare i Checkpoint</strong>: Verifica di avere le informazioni critiche prima di cambiare fase</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        📋 Legenda Simboli nello Script
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⏸️</span>
                          <span className="text-muted-foreground"><strong>PAUSA</strong> - Fermati e aspetta risposta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎧</span>
                          <span className="text-muted-foreground"><strong>ASCOLTA</strong> - Attenzione alla risposta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💬</span>
                          <span className="text-muted-foreground"><strong>REAGISCI</strong> - Mostra empatia</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🍪</span>
                          <span className="text-muted-foreground"><strong>BISCOTTINO</strong> - Complimento breve</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⛔</span>
                          <span className="text-muted-foreground"><strong>CHECKPOINT</strong> - Verifica info critiche</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔥</span>
                          <span className="text-muted-foreground"><strong>LADDER</strong> - Scava con i "Perché"</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-6">
                      <h3 className="font-semibold text-lg mb-4">Come Usare lo Script Manager</h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">1</span>
                          <div>
                            <p className="font-medium">Seleziona uno Script</p>
                            <p className="text-sm text-muted-foreground">
                              Scegli tra <strong>Discovery</strong>, <strong>Demo</strong> o <strong>Obiezioni</strong> nella sidebar, poi seleziona lo script.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">2</span>
                          <div>
                            <p className="font-medium">Modifica Energia, Tono, Ladder</p>
                            <p className="text-sm text-muted-foreground">
                              Clicca "Modifica", poi seleziona una Fase o Step. Nel pannello destro potrai configurare:
                              energia, tono, volume, ritmo, lessico e il Ladder dei Perché.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">3</span>
                          <div>
                            <p className="font-medium">Attiva per un Agente</p>
                            <p className="text-sm text-muted-foreground">
                              Clicca "Attiva" e scegli per quale AI Sales Agent usare questo script. 
                              <strong className="text-primary"> Ogni agente può avere un solo script per tipo</strong> (Discovery, Demo, Obiezioni).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Suggerimenti
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• I badge colorati (<span className="text-red-500">🔴 ALTO</span>, <span className="text-yellow-500">🟡 MEDIO</span>, <span className="text-blue-500">🔵 BASSO</span>) indicano il livello di energia</li>
                        <li>• L'icona 🪜 indica che lo step ha un Ladder dei Perché attivo</li>
                        <li>• Puoi creare più script dello stesso tipo e attivarli per agenti diversi</li>
                        <li>• Le modifiche vengono salvate automaticamente nel database</li>
                      </ul>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowGuideDialog(false)}>Ho capito!</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center gap-2">
                {!showBuilder && (
                  <>
                    {isEditing ? (
                        <>
                            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Annulla</Button>
                            <Button size="sm" onClick={handleSave} disabled={updateScriptMutation.isPending}>
                                {updateScriptMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                                <Save className="h-4 w-4 mr-2" /> Salva
                            </Button>
                        </>
                    ) : selectedScriptId && (
                        <>
                            <div className="flex items-center gap-1">
                                <Button variant={editorMode === 'blocks' ? 'default' : 'outline'} size="sm" onClick={() => setEditorMode('blocks')} disabled={parsingFailed}>
                                    <Blocks className="h-4 w-4 mr-1" />
                                    Blocchi
                                </Button>
                                <Button variant={editorMode === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setEditorMode('text')}>
                                    <Code className="h-4 w-4 mr-1" />
                                    Testo
                                </Button>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                                <Edit3 className="h-4 w-4 mr-2" /> Modifica
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => {
                                setScriptToActivate(selectedScript.id);
                                setShowAgentSelectDialog(true);
                              }} 
                              disabled={activateScriptMutation.isPending}
                            >
                              <Play className="h-4 w-4 mr-2" />
                              {selectedScript?.isActive ? 'Cambia Agente' : 'Attiva'}
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => {
                              if (confirm('Sei sicuro di voler eliminare questo script?')) {
                                deleteScriptMutation.mutate(selectedScriptId);
                              }
                            }} disabled={deleteScriptMutation.isPending}>
                                <Trash2 className="h-4 w-4 mr-2" /> Elimina
                            </Button>
                        </>
                    )}
                  </>
                )}
            </div>
        </header>

        <ResizablePanelGroup 
          direction="horizontal" 
          className="flex-1"
          key={showBuilder ? "builder-layout" : "normal-layout"}
        >
          {/* COLONNA 1: LISTA SCRIPT */}
          <ResizablePanel 
            id="sidebar-panel"
            order={1}
            defaultSize={showBuilder ? 0 : 20} 
            minSize={showBuilder ? 0 : 15} 
            maxSize={showBuilder ? 0 : 30}
            collapsible={true}
          >
            <div className="h-full flex flex-col bg-background">
              <div className="p-2 border-b">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="discovery" className="text-xs">Discovery</TabsTrigger>
                    <TabsTrigger value="demo" className="text-xs">Demo</TabsTrigger>
                    <TabsTrigger value="objections" className="text-xs">Obiezioni</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {isLoadingScripts ? <Loader2 className="h-6 w-6 animate-spin mx-auto mt-4" /> :
                   scripts.filter(s => s.scriptType === activeTab).map((script) => (
                     <ScriptListItem key={script.id} script={script} isSelected={selectedScriptId === script.id} onSelect={handleSelectScript} />
                  ))}
                </div>
              </ScrollArea>
              <div className="p-2 border-t space-y-2">
                <Button 
                  variant={showBuilder ? "secondary" : "default"} 
                  className="w-full" 
                  onClick={() => setShowBuilder(!showBuilder)}
                >
                  <Wand2 className="h-4 w-4 mr-2" /> 
                  {showBuilder ? 'Chiudi Builder' : 'Script Builder'}
                </Button>
                <Dialog open={showNewScriptDialog} onOpenChange={setShowNewScriptDialog}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" /> Nuovo Script
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Crea Nuovo Script</DialogTitle>
                      <DialogDescription>
                        Crea un nuovo script di vendita per il tuo AI Sales Agent
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label>Tipo</Label>
                        <Select value={newScriptType} onValueChange={(v) => setNewScriptType(v as any)}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="discovery">Discovery Call</SelectItem>
                            <SelectItem value="demo">Demo Call</SelectItem>
                            <SelectItem value="objections">Gestione Obiezioni</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                        <div className="space-y-0.5">
                          <Label htmlFor="use-template" className="text-sm font-medium">
                            Usa Template Base
                          </Label>
                          <p className="text-xs text-muted-foreground">
                            Inizia con lo script base completo già configurato
                          </p>
                        </div>
                        <Switch
                          id="use-template"
                          checked={useTemplate}
                          onCheckedChange={setUseTemplate}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Nome Script {!useTemplate && <span className="text-destructive">*</span>}</Label>
                        <Input
                          placeholder={useTemplate ? "(opzionale - usa nome default)" : "Es. Discovery Call v2.0"}
                          value={newScriptName}
                          onChange={(e) => setNewScriptName(e.target.value)}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowNewScriptDialog(false)}>
                        Annulla
                      </Button>
                      <Button 
                        onClick={() => createFromTemplateMutation.mutate({ name: newScriptName.trim() || '', scriptType: newScriptType })}
                        disabled={createFromTemplateMutation.isPending}
                      >
                        {createFromTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Crea da Template
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Dialog Selezione Agente per Attivazione Script */}
                <Dialog open={showAgentSelectDialog} onOpenChange={(open) => {
                  setShowAgentSelectDialog(open);
                  if (!open) setScriptToActivate(null);
                }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-primary" />
                        Seleziona Agente
                      </DialogTitle>
                      <DialogDescription>
                        Scegli per quale AI Sales Agent vuoi attivare questo script. 
                        Ogni agente può avere un solo script per tipo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2 py-4 max-h-[300px] overflow-y-auto">
                      {agents.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Bot className="h-12 w-12 mx-auto mb-2 opacity-50" />
                          <p>Nessun agente configurato.</p>
                          <p className="text-sm">Crea prima un AI Sales Agent.</p>
                        </div>
                      ) : (
                        agents.map((agent) => {
                          const scriptToActivateData = scripts.find(s => s.id === scriptToActivate);
                          const currentAssignment = scriptToActivateData 
                            ? agent.scriptAssignments[scriptToActivateData.scriptType as keyof typeof agent.scriptAssignments]
                            : null;
                          const isCurrentlyAssigned = currentAssignment?.scriptId === scriptToActivate;
                          
                          return (
                            <button
                              key={agent.id}
                              className={cn(
                                "w-full text-left p-4 rounded-lg border transition-all hover:bg-muted/50",
                                isCurrentlyAssigned && "border-primary bg-primary/5"
                              )}
                              onClick={() => {
                                if (scriptToActivate) {
                                  activateScriptMutation.mutate({ 
                                    scriptId: scriptToActivate, 
                                    agentId: agent.id 
                                  });
                                }
                              }}
                              disabled={activateScriptMutation.isPending}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                    <Bot className="h-5 w-5 text-primary" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{agent.agentName}</p>
                                    <p className="text-sm text-muted-foreground">{agent.businessName}</p>
                                  </div>
                                </div>
                                {isCurrentlyAssigned && (
                                  <Badge variant="default" className="text-xs">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Attivo
                                  </Badge>
                                )}
                              </div>
                              {currentAssignment && !isCurrentlyAssigned && (
                                <p className="text-xs text-muted-foreground mt-2 pl-13">
                                  Attualmente usa: {currentAssignment.scriptName}
                                </p>
                              )}
                            </button>
                          );
                        })
                      )}
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowAgentSelectDialog(false)}>
                        Annulla
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          
          {/* COLONNA 2: EDITOR / BUILDER */}
          <ResizablePanel id="editor-panel" order={2} defaultSize={showBuilder ? 95 : 50} minSize={showBuilder ? 80 : 30}>
            <div className="h-full flex flex-col bg-background">
              {showBuilder ? (
                <ScriptBuilderTab 
                  onSave={handleBuilderSave} 
                  isSaving={isSavingBuilder}
                  initialStructure={selectedScript ? blockStructure : undefined}
                  initialScriptType={selectedScript?.scriptType}
                  initialScriptName={selectedScript?.name}
                />
              ) : (
                <>
                  {!selectedScriptId ? <EditorWelcomeMessage /> :
                   isLoadingScript ? <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
                   isError ? <EditorErrorMessage /> :
                   selectedScript && (
                      <div className="flex-1 flex flex-col overflow-hidden">
                         <div className="p-3 border-b flex items-center justify-between">
                           <EditableScriptName isEditing={isEditing} value={editedName} onChange={setEditedName} />
                         </div>
                         <ScrollArea className="flex-1">
                           <div className="p-4">
                             {isEditing && !parsingFailed && (
                                 blockStructure ? 
                                 <BlockEditor 
                                   structure={blockStructure} 
                                   selectedBlock={selectedBlock} 
                                   onSelectBlock={setSelectedBlock} 
                                   onAddBlock={handleBlockAdd}
                                   onDeleteBlock={handleBlockDelete}
                                   isEditing
                                   energySettings={selectedScript?.energySettings}
                                   ladderOverrides={selectedScript?.ladderOverrides}
                                   stepQuestions={selectedScript?.stepQuestions}
                                 /> 
                                 : <Loader2 className="h-6 w-6 animate-spin mx-auto mt-10" />
                             )}
                             {isEditing && parsingFailed && (
                                 <ParsingFailedEditor value={editedContent} onChange={setEditedContent} />
                             )}
                             {!isEditing && editorMode === 'blocks' && !parsingFailed && blockStructure && (
                                 <BlockEditor 
                                   structure={blockStructure} 
                                   selectedBlock={selectedBlock} 
                                   onSelectBlock={setSelectedBlock} 
                                   onAddBlock={handleBlockAdd}
                                   onDeleteBlock={handleBlockDelete}
                                   isEditing={false}
                                   energySettings={selectedScript?.energySettings}
                                   ladderOverrides={selectedScript?.ladderOverrides}
                                   stepQuestions={selectedScript?.stepQuestions}
                                 />
                             )}
                             {!isEditing && editorMode === 'text' && (
                                 <pre className="whitespace-pre-wrap text-sm font-mono">{selectedScript.content}</pre>
                             )}
                             {!isEditing && parsingFailed && editorMode === 'blocks' && (
                                 <Alert variant="destructive">
                                     <AlertCircle className="h-4 w-4" />
                                     <AlertTitle>Parsing Non Valido</AlertTitle>
                                     <AlertDescription>
                                         Visualizzazione blocchi non disponibile. Clicca "Testo" per vedere il contenuto.
                                     </AlertDescription>
                                 </Alert>
                             )}
                           </div>
                         </ScrollArea>
                      </div>
                  )}
                </>
              )}
            </div>
          </ResizablePanel>
          {!showBuilder && <ResizableHandle withHandle />}

          {/* COLONNA 3: ISPETTORE/DETTAGLI */}
          {!showBuilder && (
            <ResizablePanel id="inspector-panel" order={3} defaultSize={30} minSize={20} maxSize={40}>
                <div className="h-full flex flex-col bg-background border-l">
                    <ScrollArea className="flex-1 p-4">
                        {renderInspector()}
                    </ScrollArea>
                </div>
            </ResizablePanel>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// Sub-components for cleaner main component
const ScriptListItem = ({ script, isSelected, onSelect }: { script: SalesScript, isSelected: boolean, onSelect: (id: string) => void }) => (
    <button
        className={cn(
            'w-full text-left p-3 rounded-lg border-l-4 transition-all hover:bg-muted/50',
            scriptTypeColors[script.scriptType],
            isSelected ? 'bg-primary/15 border-l-4 border-primary font-semibold shadow-sm ring-1 ring-primary/30' : 'bg-transparent'
        )}
        onClick={() => onSelect(script.id)}
    >
        <div className="flex items-start justify-between mb-1">
            <span className="font-semibold text-sm truncate pr-2 flex-1">{script.name}</span>
            {script.isActive && <Badge variant="default" className="text-xs h-5"><CheckCircle className="h-3 w-3 mr-1" /> Attivo</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>v{script.version}</span>
            <span className="text-xs">•</span>
            <span>{script.structure?.phases?.length || 0} fasi</span>
        </div>
    </button>
);

const InspectorWelcomeMessage = () => (
    <div className="flex-1 flex items-center justify-center text-center p-8 h-full">
        <div className="text-muted-foreground">
            <Info className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
            <p>Seleziona uno script per vedere i dettagli.</p>
        </div>
    </div>
);

const ScriptDetailPanel = ({ script }: { script: SalesScript }) => (
     <div className="space-y-4">
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Dettagli Script</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Stato</span>
                    {script.isActive 
                      ? <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Attivo</Badge> 
                      : <Badge variant="secondary"><X className="h-3 w-3 mr-1" /> Inattivo</Badge>
                    }
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Versione</span><span className="font-medium">v{script.version}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tipo</span><span className="font-medium">{scriptTypeLabels[script.scriptType]}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ultima Modifica</span>
                    <span className="font-medium">{new Date(script.updatedAt).toLocaleDateString('it-IT')}</span>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Struttura</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {script.structure?.phases?.map(phase => (
                    <div key={phase.id} className="text-sm p-2 rounded-md bg-muted/50">
                        <p className="font-medium">Fase {phase.number}: {phase.name}</p>
                        <p className="text-xs text-muted-foreground">{phase.steps?.length || 0} step</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    </div>
);

const EditorWelcomeMessage = () => (
    <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
            <FileText className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Seleziona uno Script</h2>
            <p className="text-muted-foreground max-w-md">Scegli uno script dalla lista per visualizzarlo e modificarlo.</p>
        </div>
    </div>
);

const EditorErrorMessage = () => (
     <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Caricamento Fallito</AlertTitle>
            <AlertDescription>
                Impossibile caricare lo script. Potrebbe essere stato eliminato o esserci un problema di rete.
            </AlertDescription>
        </Alert>
    </div>
);

const EditableScriptName = ({ isEditing, value, onChange }: { isEditing: boolean, value: string, onChange: (val: string) => void }) => (
    isEditing ?
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-base font-semibold" /> :
    <h2 className="text-base font-semibold truncate py-1">{value}</h2>
);

const ParsingFailedEditor = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => (
    <>
        <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Modalità Testo Forzata</AlertTitle>
            <AlertDescription>
                La struttura dello script non è valida. Puoi modificarlo solo come testo.
                Correggi la formattazione per riattivare l'editor a blocchi.
            </AlertDescription>
        </Alert>
        <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[60vh] font-mono text-sm border-dashed"
        />
    </>
);
