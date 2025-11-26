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
  Code
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

// Types and Constants
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

  // API Calls
  const { data: scripts = [], isLoading: isLoadingScripts } = useQuery<SalesScript[]>({
    queryKey: ['sales-scripts'],
    queryFn: async () => {
      const res = await fetch('/api/sales-scripts', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch scripts');
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

  const updateScriptMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; content?: string }) => {
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
    mutationFn: (scriptId: string) => fetch(`/api/sales-scripts/${scriptId}/activate`, { method: 'POST', headers: getAuthHeaders() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Script attivato', description: 'Lo script è ora attivo per l\'AI.' });
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

  // Handlers
  const handleSave = () => {
    if (!selectedScriptId) return;
    const contentToSave = editorMode === 'blocks' && blockStructure ? blocksToText(blockStructure) : editedContent;
    updateScriptMutation.mutate({ id: selectedScriptId, name: editedName, content: contentToSave });
  };

  const handleSelectScript = (id: string) => {
    if (isEditing) {
      if (confirm('Hai modifiche non salvate. Sei sicuro di voler cambiare script?')) {
        setIsEditing(false);
      } else {
        return;
      }
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
  useEffect(() => {
    if (selectedScript) {
      try {
        const parsed = parseTextToBlocks(selectedScript.content, selectedScript.scriptType);
        
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
        
        setBlockStructure(parsed);
        setParsingFailed(!parsed || !parsed.phases?.length);
        setEditorMode((!parsed || !parsed.phases?.length) ? 'text' : 'blocks');
      } catch {
        setBlockStructure(null);
        setParsingFailed(true);
        setEditorMode('text');
      }
      setEditedContent(selectedScript.content);
      setEditedName(selectedScript.name);
      setSelectedBlock(null);
    }
  }, [selectedScript]);

  // RENDER: Inspector Panel
  const renderInspector = () => {
    if (!selectedScriptId || !selectedScript) return <InspectorWelcomeMessage />;

    if (isEditing && selectedBlock) {
        switch (selectedBlock.type) {
            case 'phase': return <PhaseInspector phase={selectedBlock as Phase} onUpdate={handleBlockUpdate} isEditing />;
            case 'step': return <StepInspector step={selectedBlock as Step} onUpdate={handleBlockUpdate} isEditing />;
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
            <h1 className="text-lg font-semibold flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> Script Manager
            </h1>
            <div className="flex items-center gap-2">
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
                        {!selectedScript?.isActive && (
                            <Button size="sm" onClick={() => activateScriptMutation.mutate(selectedScript.id)} disabled={activateScriptMutation.isPending}>
                                <Play className="h-4 w-4 mr-2" />Attiva
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={() => {
                          if (confirm('Sei sicuro di voler eliminare questo script?')) {
                            deleteScriptMutation.mutate(selectedScriptId);
                          }
                        }} disabled={deleteScriptMutation.isPending}>
                            <Trash2 className="h-4 w-4 mr-2" /> Elimina
                        </Button>
                    </>
                )}
            </div>
        </header>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* COLONNA 1: LISTA SCRIPT */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
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
              <div className="p-2 border-t">
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
              </div>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          
          {/* COLONNA 2: EDITOR */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col bg-background">
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
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />

          {/* COLONNA 3: ISPETTORE/DETTAGLI */}
          <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
              <div className="h-full flex flex-col bg-background border-l">
                  <ScrollArea className="flex-1 p-4">
                      {renderInspector()}
                  </ScrollArea>
              </div>
          </ResizablePanel>
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
